import {
  addDoc, updateDoc, deleteDoc as firestoreDeleteDoc, doc,
  collection, getDocs, query, where, getDoc, runTransaction, Timestamp, writeBatch,
  limit, startAfter, orderBy, increment // Added imports for pagination
} from 'firebase/firestore';
import { db } from '../config/firebase';
import useAppStore from '../store/useAppStore';

const LEDGER_ID = 'main-ledger';
const COLLECTION_PATH = `ledgers/${LEDGER_ID}/transactions`;

// Use this for simple updates
export const fastUpdateParentStats = async (parentId, changeInAmount) => {
  if (!parentId) return;
  const parentRef = doc(db, COLLECTION_PATH, parentId);

  // We try to optimize, but if the doc doesn't exist or other issues occur, 
  // it will just fail silently or throw.
  // For robustness, one might want to check existence but that costs a read.
  // The prompt explicitly asked for "no reads required".
  try {
    await updateDoc(parentRef, {
      netAmount: increment(changeInAmount),
      hasRefunds: true
    });
  } catch (error) {
    console.error("Failed to fast-update parent stats:", error);
    useAppStore.getState().showToast(
      `CRITICAL: Parent transaction ${parentId} failed to update! Balance may be wrong.`,
      true
    );
  }
};

// Helper: Recalculate parent stats
const updateParentStats = async (parentId) => {
  if (!parentId) return;

  try {
    const colRef = collection(db, COLLECTION_PATH);

    // 1. Get both legacy and new links
    const q1 = query(colRef, where("parentTransactionId", "==", parentId));
    const q2 = query(colRef, where("parentTransactionIds", "array-contains", parentId));

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const children = new Map();
    // Filter out deleted children
    snap1.forEach(d => { if (!d.data().isDeleted) children.set(d.id, d.data()); });
    snap2.forEach(d => { if (!d.data().isDeleted) children.set(d.id, d.data()); });

    let totalRefunds = 0;
    let lastRefundDate = null;

    children.forEach((data) => {
      // Skip Repayments for Net Cost calculation
      if (data.isReturn) return;

      let allocatedAmount = 0;

      // Find specific allocation
      if (data.linkedTransactions && Array.isArray(data.linkedTransactions)) {
        const link = data.linkedTransactions.find(l => l.id === parentId);
        allocatedAmount = link ? link.amount : data.amount;
      } else {
        allocatedAmount = data.amount;
      }

      totalRefunds += allocatedAmount; // Refunds are negative

      if (data.timestamp) {
        if (!lastRefundDate || data.timestamp.toMillis() > lastRefundDate.toMillis()) {
          lastRefundDate = data.timestamp;
        }
      }
    });

    const parentRef = doc(db, COLLECTION_PATH, parentId);
    const parentSnap = await getDoc(parentRef);

    if (parentSnap.exists()) {
      const parentData = parentSnap.data();
      const originalAmount = parentData.amount;
      const newNet = originalAmount + totalRefunds;

      await updateDoc(parentRef, {
        netAmount: newNet,
        hasRefunds: totalRefunds !== 0,
        lastRefundDate: lastRefundDate
      });
    }
  } catch (error) {
    console.error("Failed to update parent stats:", error);
    useAppStore.getState().showToast(
      `CRITICAL: Parent transaction ${parentId} failed to update! Balance may be wrong.`,
      true
    );
  }
};

export const addTransaction = async (txnData) => {
  const docRef = await addDoc(collection(db, COLLECTION_PATH), {
    ...txnData,
    isDeleted: false,
    createdAt: Timestamp.now()
  });

  if (txnData.parentTransactionIds && txnData.parentTransactionIds.length > 0) {
    await Promise.all(txnData.parentTransactionIds.map(pid => updateParentStats(pid)));
  } else if (txnData.parentTransactionId) {
    await updateParentStats(txnData.parentTransactionId);
  }

  return docRef.id;
};

export const updateTransaction = async (id, txnData, oldParentId) => {
  const docRef = doc(db, COLLECTION_PATH, id);
  await updateDoc(docRef, txnData);

  if (txnData.parentTransactionIds && txnData.parentTransactionIds.length > 0) {
    await Promise.all(txnData.parentTransactionIds.map(pid => updateParentStats(pid)));
  } else if (txnData.parentTransactionId) {
    await updateParentStats(txnData.parentTransactionId);
  }

  if (oldParentId && (!txnData.parentTransactionIds || !txnData.parentTransactionIds.includes(oldParentId))) {
    if (oldParentId !== txnData.parentTransactionId) {
      await updateParentStats(oldParentId);
    }
  }
};

// Fix 3 & Feature 8: Atomic Soft Delete
export const deleteTransaction = async (id, parentId) => {
  const txnRef = doc(db, COLLECTION_PATH, id);

  try {
    await runTransaction(db, async (transaction) => {
      const txnDoc = await transaction.get(txnRef);
      if (!txnDoc.exists()) throw new Error("Document does not exist!");

      const colRef = collection(db, COLLECTION_PATH);
      const qChild = query(
        colRef,
        where("parentTransactionIds", "array-contains", id),
        where("isDeleted", "==", false)
      );
      const qChildLegacy = query(
        colRef,
        where("parentTransactionId", "==", id),
        where("isDeleted", "==", false)
      );

      const [snap1, snap2] = await Promise.all([getDocs(qChild), getDocs(qChildLegacy)]);

      if (!snap1.empty || !snap2.empty) {
        throw new Error("Cannot delete: Active linked refunds/repayments exist.");
      }

      transaction.update(txnRef, {
        isDeleted: true,
        deletedAt: Timestamp.now()
      });
    });

    if (parentId) {
      await updateParentStats(parentId);
    }
  } catch (e) {
    console.error("Delete failed:", e);
    useAppStore.getState().showToast(
      `CRITICAL: Failed to delete transaction ${id}. ${e.message}`,
      true
    );
    throw e;
  }
};

export const restoreTransaction = async (id) => {
  const txnRef = doc(db, COLLECTION_PATH, id);
  await updateDoc(txnRef, { isDeleted: false, deletedAt: null });
};

export const permanentDeleteTransaction = async (id) => {
  await firestoreDeleteDoc(doc(db, COLLECTION_PATH, id));
};

export const moveTransactionToGroup = async (id, newGroupId) => {
  const txnRef = doc(db, COLLECTION_PATH, id);
  const colRef = collection(db, COLLECTION_PATH);
  const qChildren = query(colRef, where("parentTransactionId", "==", id));
  const snap = await getDocs(qChildren);
  const batch = writeBatch(db);

  batch.update(txnRef, { groupId: newGroupId });
  snap.forEach(childDoc => {
    batch.update(childDoc.ref, { groupId: newGroupId });
  });

  await batch.commit();
};

// --- NEW PAGINATION FEATURE ---
export const fetchPaginatedTransactions = async (pageSize, lastDoc = null, filters = {}) => {
  try {
    const colRef = collection(db, COLLECTION_PATH);

    // 1. Base Query: Sort by time (Removing 'isDeleted' server-side filter to bypass Composite Index requirement)
    // NOTE: We fetch all and filter client-side. This avoids the "isDeleted + timestamp" index error.
    let q = query(colRef, orderBy('timestamp', 'desc'));

    // 2. Apply Filters
    if (filters.tag) {
      q = query(q, where('tag', '==', filters.tag));
    }

    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);

      // FIX: Use Timestamp.fromMillis because you store dates as Firestore Timestamps
      q = query(q,
        where('timestamp', '>=', Timestamp.fromMillis(start.getTime())),
        where('timestamp', '<=', Timestamp.fromMillis(end.getTime()))
      );
    } else if (filters.month) {
      const [year, month] = filters.month.split('-');
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);

      // FIX: Use Timestamp.fromMillis here too
      q = query(q,
        where('timestamp', '>=', Timestamp.fromMillis(start.getTime())),
        where('timestamp', '<=', Timestamp.fromMillis(end.getTime()))
      );
    }

    // 3. Apply Pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }

    // Fetch slightly more to ensure we have enough after active filtering
    // (Optimization: Buffer for deleted items)
    q = query(q, limit(pageSize * 1.5));

    const snapshot = await getDocs(q);

    // 1. Filter Snapshots directly to keep reference to the Doc objects
    const activeSnapshots = snapshot.docs.filter(d => !d.data().isDeleted);

    // 2. Slice to page size
    const visibleSnapshots = activeSnapshots.slice(0, pageSize);

    // 3. Determine Cursor
    // If we have visible items, the cursor is the last VISIBLE item. 
    // (This ensures that if we fetched 15 valid items but showed 10, the next page starts after #10 to pick up #11)
    // If NO visible items (all trash), cursor is the last SCANNED item (to advance past the trash pile).
    const lastVisibleCursor = visibleSnapshots.length > 0
      ? visibleSnapshots[visibleSnapshots.length - 1]
      : snapshot.docs[snapshot.docs.length - 1];

    return {
      data: visibleSnapshots.map(d => ({ id: d.id, ...d.data() })),
      lastDoc: lastVisibleCursor,
      hasMore: snapshot.docs.length >= pageSize // Approximate check
    };
  } catch (error) {
    console.error("Pagination Error:", error);
    throw error;
  }
};

const RECURRING_PATH = `ledgers/${LEDGER_ID}/recurring`;

// --- RECURRING TRANSACTIONS LOGIC ---

// 1. Check for items due today or in the past
export const checkDueRecurring = async () => {
  const now = new Date();
  now.setHours(23, 59, 59, 999); // End of today

  const q = query(
    collection(db, RECURRING_PATH),
    where("nextDueDate", "<=", Timestamp.fromMillis(now.getTime())),
    where("isActive", "==", true)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// 2. Log the transaction and advance the due date
export const processRecurringTransaction = async (recurringId, recurringData) => {
  const batch = writeBatch(db);

  // A. Create the actual Expense Transaction
  const newTxnRef = doc(collection(db, COLLECTION_PATH));
  const txnData = {
    amount: recurringData.amount,
    category: recurringData.category || 'Recurring',
    expenseName: recurringData.name,
    payer: 'me',
    splits: { 'me': recurringData.amount },
    timestamp: Timestamp.now(),
    type: 'expense',
    groupId: recurringData.groupId || 'personal',
    isDeleted: false,
    recurringSourceId: recurringId,
    paymentMode: recurringData.paymentMode || 'Online',
    tag: recurringData.tag || '',
    place: recurringData.place || ''
  };
  batch.set(newTxnRef, txnData);

  // B. Calculate Next Due Date (Default: Monthly)
  const currentDue = recurringData.nextDueDate.toDate();
  const nextDue = new Date(currentDue);

  if (recurringData.frequency === 'yearly') {
    nextDue.setFullYear(nextDue.getFullYear() + 1);
  } else {
    nextDue.setMonth(nextDue.getMonth() + 1);
  }

  // C. Update the Recurring Rule
  const recurRef = doc(db, RECURRING_PATH, recurringId);
  batch.update(recurRef, {
    nextDueDate: Timestamp.fromDate(nextDue),
    lastProcessedAt: Timestamp.now()
  });

  await batch.commit();
  return newTxnRef.id;
};

// 3. Skip this month (just update the date)
export const skipRecurringTransaction = async (recurringId, currentDueDate, frequency = 'monthly') => {
  const nextDue = new Date(currentDueDate.toDate());

  if (frequency === 'yearly') {
    nextDue.setFullYear(nextDue.getFullYear() + 1);
  } else {
    nextDue.setMonth(nextDue.getMonth() + 1);
  }

  const recurRef = doc(db, RECURRING_PATH, recurringId);
  await updateDoc(recurRef, {
    nextDueDate: Timestamp.fromDate(nextDue)
  });
};

// --- CRUD for Recurring Transactions ---
export const addRecurringTransaction = async (data) => {
  const ref = collection(db, RECURRING_PATH);
  await addDoc(ref, {
    ...data,
    isActive: true,
    createdAt: Timestamp.now()
  });
};

export const updateRecurringTransaction = async (id, data) => {
  const ref = doc(db, RECURRING_PATH, id);
  await updateDoc(ref, data);
};

export const deleteRecurringTransaction = async (id) => {
  const ref = doc(db, RECURRING_PATH, id);
  await firestoreDeleteDoc(ref);
};

// --- CRUD for Templates (Pinning) ---
export const updateTemplate = async (id, data) => {
  const ref = doc(db, `ledgers/${LEDGER_ID}/templates`, id);
  await updateDoc(ref, data);
};

export const deleteTemplate = async (id) => {
  const ref = doc(db, `ledgers/${LEDGER_ID}/templates`, id);
  await firestoreDeleteDoc(ref);
};