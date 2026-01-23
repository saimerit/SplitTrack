import {
  addDoc, updateDoc, deleteDoc as firestoreDeleteDoc, doc, setDoc,
  collection, getDocs, query, where, getDoc, runTransaction, Timestamp, writeBatch,
  limit, startAfter, orderBy, increment // Added imports for pagination
} from 'firebase/firestore';
import { db } from '../config/firebase';
import useAppStore from '../store/useAppStore';

import { LEDGER_ID } from '../config/constants';

const COLLECTION_PATH = `ledgers/${LEDGER_ID}/transactions`;
const SUMMARY_PATH = `ledgers/${LEDGER_ID}/summaries/dashboard`;

/**
 * RECTIFIED STATS:
 * Reverts to using original transaction amounts for the global ledger.
 * Mathematical integrity is maintained by (Expense - Settlement).
 * remainingAmount and overpaidAmount are used for UI labels/filtering only.
 */
export const rectifyAllStats = async (participants = []) => {
  const colRef = collection(db, COLLECTION_PATH);
  const q = query(colRef, where("isDeleted", "==", false));
  const snap = await getDocs(q);
  const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  let myPersonalBalances = {};
  participants.forEach(p => {
    if (p.uniqueId !== 'me') myPersonalBalances[p.uniqueId] = 0;
  });

  transactions.forEach(txn => {
    const payer = txn.payer || 'me';
    // FIX: Always use original amount for global ledger math
    const amount = parseFloat(txn.amount) || 0;
    const splits = txn.splits || {};

    if (txn.type === 'income') return;

    if (txn.isReturn) {
      const recipient = txn.participants?.[0];
      if (!recipient || recipient === 'me') return;
      if (payer === 'me') myPersonalBalances[recipient] = (myPersonalBalances[recipient] || 0) + amount;
      else myPersonalBalances[payer] = (myPersonalBalances[payer] || 0) - amount;
    } else {
      if (payer === 'me') {
        Object.entries(splits).forEach(([uid, share]) => {
          if (uid !== 'me') myPersonalBalances[uid] = (myPersonalBalances[uid] || 0) + share;
        });
      } else if (splits['me'] > 0) {
        myPersonalBalances[payer] = (myPersonalBalances[payer] || 0) - splits['me'];
      }
    }
  });

  const netPosition = Object.values(myPersonalBalances).reduce((sum, val) => sum + val, 0);
  const summaryData = { netPosition, myPersonalBalances, lastUpdated: Timestamp.now() };

  await setDoc(doc(db, SUMMARY_PATH), summaryData);
  useAppStore.getState().setDashboardStats(summaryData);
  return summaryData;
};

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

// HELPER: Fixed parent stats calculation
const updateParentStats = async (parentId) => {
  if (!parentId) return;
  const parentRef = doc(db, COLLECTION_PATH, parentId);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists()) return;

  const colRef = collection(db, COLLECTION_PATH);
  const q1 = query(colRef, where("parentTransactionId", "==", parentId), where("isDeleted", "==", false));
  const q2 = query(colRef, where("parentTransactionIds", "array-contains", parentId), where("isDeleted", "==", false));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  let totalSettled = 0;
  [...snap1.docs, ...snap2.docs].forEach(d => {
    const data = d.data();
    // FIX: Don't subtract a credit from its own source (Prevents ₹998 remaining glitch)
    if (data.type === 'credit_link' && data.sourceCreditId === parentId) return;

    if (data.linkedTransactions) {
      const link = data.linkedTransactions.find(l => l.id === parentId);
      totalSettled += Math.abs(link ? link.amount : data.amount);
    } else {
      totalSettled += Math.abs(data.amount);
    }
  });

  const original = Math.abs(parseFloat(parentSnap.data().amount) || 0);
  const remaining = Math.max(0, original - totalSettled);
  const overpaid = Math.max(0, totalSettled - original);

  await updateDoc(parentRef, {
    settledAmount: totalSettled,
    remainingAmount: remaining, // Correctly shows 'Final Difference' (₹164)
    overpaidAmount: overpaid,
    // Marks as 'settled' once balance is 0 or it's a consumed credit source
    settlementStatus: (remaining === 0 || parentSnap.data().isCreditConsumed) ? 'settled' : 'partial',
    isAvailableAsCredit: overpaid > 0 && !parentSnap.data().isCreditConsumed
  });
};

/**
 * Fetches transactions where the user has overpaid, 
 * allowing these to be linked as "payments" for other expenses.
 */
export const getAvailableCredits = async () => {
  const colRef = collection(db, COLLECTION_PATH);
  // FIX C: Ensure we only get unconsumed credits
  const q = query(
    colRef,
    where("overpaidAmount", ">", 0),
    where("isAvailableAsCredit", "==", true),
    where("isDeleted", "==", false)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

/**
 * Atomically links an overpayment credit to a target expense.
 * This ensures "link once" rule - a credit can only be used one time.
 * @param {string} creditId - The ID of the overpaid transaction to consume as credit
 * @param {string} targetExpenseId - The expense that will receive the credit
 * @param {number} amountToLink - The amount being linked from the credit
 */
export const linkOverpaymentAsCredit = async (creditId, targetExpenseId) => {
  await runTransaction(db, async (transaction) => {
    const creditRef = doc(db, COLLECTION_PATH, creditId);
    const creditSnap = await transaction.get(creditRef);
    if (!creditSnap.exists()) throw new Error("Credit source not found");

    const creditData = creditSnap.data();
    const actualCreditValue = creditData.overpaidAmount || 0;

    if (actualCreditValue <= 0 || creditData.isCreditConsumed) {
      throw new Error("Credit already used or invalid.");
    }

    // Mark source as consumed (visible once only)
    transaction.update(creditRef, {
      isCreditConsumed: true,
      isAvailableAsCredit: false,
      settlementStatus: 'settled'
    });

    // Create adjustment link for target (The ₹2 "Cut")
    const linkRef = doc(collection(db, COLLECTION_PATH));
    transaction.set(linkRef, {
      type: 'credit_link',
      amount: actualCreditValue,
      parentTransactionIds: [targetExpenseId],
      isReturn: true,
      isDeleted: false,
      timestamp: Timestamp.now(),
      sourceCreditId: creditId,
      expenseName: `Adjustment: Credit from ${creditData.expenseName || 'overpayment'}`
    });
  });

  await updateParentStats(targetExpenseId);
  await rectifyAllStats(useAppStore.getState().rawParticipants);
};

export const addTransaction = async (txnData) => {
  // --- OPTIMISTIC UI: Immediate local update ---
  const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = Timestamp.now();

  const localTxn = {
    ...txnData,
    id: tempId,
    isDeleted: false,
    createdAt,
    syncStatus: 'pending'
  };

  // Push to local store immediately for instant UI feedback
  useAppStore.getState().addTransactionLocal(localTxn);

  // --- BACKGROUND SYNC: Firestore write ---
  try {
    const docRef = await addDoc(collection(db, COLLECTION_PATH), {
      ...txnData,
      isDeleted: false,
      createdAt
    });

    // FIX B: If this transaction uses a credit, mark that credit as consumed
    if (txnData.linkedCreditId) {
      const creditRef = doc(db, COLLECTION_PATH, txnData.linkedCreditId);
      await updateDoc(creditRef, {
        isCreditConsumed: true,
        isAvailableAsCredit: false,
        consumedBySettlementId: docRef.id
      });
    }

    // Replace temp ID with real Firestore ID
    useAppStore.getState().replaceLocalTransaction(tempId, {
      ...localTxn,
      id: docRef.id,
      syncStatus: 'synced'
    });

    // Update parent stats if linked
    if (txnData.parentTransactionIds && txnData.parentTransactionIds.length > 0) {
      await Promise.all(txnData.parentTransactionIds.map(pid => updateParentStats(pid)));
    } else if (txnData.parentTransactionId) {
      await updateParentStats(txnData.parentTransactionId);
    }

    // Trigger background rectification to update dashboard stats
    const participants = useAppStore.getState().rawParticipants;
    rectifyAllStats(participants).catch(err => console.error('Background rectify failed:', err));

    return docRef.id;
  } catch (error) {
    // Mark as error in local state
    useAppStore.getState().markTransactionSyncError(tempId);
    useAppStore.getState().showToast('Failed to sync transaction. Will retry.', true);
    throw error;
  }
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

  // Trigger background rectification to update dashboard stats
  const participants = useAppStore.getState().rawParticipants;
  rectifyAllStats(participants).catch(err => console.error('Background rectify failed:', err));
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

    // Trigger background rectification to update dashboard stats
    const participants = useAppStore.getState().rawParticipants;
    rectifyAllStats(participants).catch(err => console.error('Background rectify failed:', err));
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

// Bulk update multiple transactions at once (for category/tag/mode changes)
export const bulkUpdateTransactions = async (ids, updateData) => {
  if (!ids || ids.length === 0) return;

  const batch = writeBatch(db);
  ids.forEach(id => {
    const docRef = doc(db, COLLECTION_PATH, id);
    batch.update(docRef, {
      ...updateData,
      updatedAt: Timestamp.now()
    });
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
  const nowMillis = now.getTime();

  // Fetch all recurring items (avoid composite index requirement)
  const q = query(collection(db, RECURRING_PATH));
  const snap = await getDocs(q);

  // Filter client-side for due items that are active
  const allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  return allItems.filter(item => {
    // Must be active
    if (!item.isActive) return false;

    // Check if due date is today or earlier
    if (!item.nextDueDate) return false;

    const dueDateMillis = item.nextDueDate.toMillis
      ? item.nextDueDate.toMillis()
      : (item.nextDueDate instanceof Date ? item.nextDueDate.getTime() : null);

    if (!dueDateMillis) return false;

    return dueDateMillis <= nowMillis;
  });
};

// 2. Log the transaction and advance the due date
export const processRecurringTransaction = async (recurringId, recurringData) => {
  const batch = writeBatch(db);

  // A. Create the actual Expense Transaction
  const newTxnRef = doc(collection(db, COLLECTION_PATH));

  // Use the due date as the transaction timestamp (so it appears on correct date in history)
  const txnTimestamp = recurringData.nextDueDate || Timestamp.now();

  // Determine transaction type (default: expense, can be income or subscription)
  const txnType = recurringData.transactionType === 'income' ? 'income' : 'expense';

  const txnData = {
    amount: recurringData.amount,
    category: recurringData.category || 'Recurring',
    expenseName: recurringData.name,
    payer: 'me',
    splits: txnType === 'income' ? {} : { 'me': recurringData.amount },
    timestamp: txnTimestamp,
    type: txnType,
    groupId: recurringData.groupId || 'personal',
    isDeleted: false,
    recurringSourceId: recurringId,
    isRecurring: true, // Flag to identify recurring transactions
    recurringType: recurringData.transactionType || 'expense', // expense, income, or subscription
    modeOfPayment: recurringData.paymentMode || 'Online',
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

  // Ensure nextDueDate is a Firestore Timestamp
  const nextDueDate = data.nextDueDate instanceof Date
    ? Timestamp.fromDate(data.nextDueDate)
    : data.nextDueDate;

  await addDoc(ref, {
    ...data,
    nextDueDate,
    isActive: true,
    createdAt: Timestamp.now()
  });
};

export const updateRecurringTransaction = async (id, data) => {
  const ref = doc(db, RECURRING_PATH, id);

  // Ensure nextDueDate is a Firestore Timestamp if present
  const updateData = { ...data };
  if (updateData.nextDueDate && updateData.nextDueDate instanceof Date) {
    updateData.nextDueDate = Timestamp.fromDate(updateData.nextDueDate);
  }

  await updateDoc(ref, updateData);
};

export const deleteRecurringTransaction = async (id) => {
  const ref = doc(db, RECURRING_PATH, id);
  await firestoreDeleteDoc(ref);
};

// --- CRUD for Templates ---
export const addTemplate = async (templateData) => {
  const ref = collection(db, `ledgers/${LEDGER_ID}/templates`);
  const docRef = await addDoc(ref, {
    ...templateData,
    createdAt: Timestamp.now(),
    usageCount: 0,
    isPinned: false
  });
  return docRef.id;
};

export const updateTemplate = async (id, data) => {
  const ref = doc(db, `ledgers/${LEDGER_ID}/templates`, id);
  await updateDoc(ref, data);
};

export const deleteTemplate = async (id) => {
  const ref = doc(db, `ledgers/${LEDGER_ID}/templates`, id);
  await firestoreDeleteDoc(ref);
};