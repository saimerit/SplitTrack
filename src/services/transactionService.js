import {
  addDoc, updateDoc, deleteDoc as firestoreDeleteDoc, doc, setDoc,
  collection, getDocs, query, where, getDoc, runTransaction, Timestamp, writeBatch,
  limit, startAfter, orderBy, increment, deleteField
} from 'firebase/firestore';
import { db } from '../config/firebase';
import useAppStore from '../store/useAppStore';

import { LEDGER_ID } from '../config/constants';

const COLLECTION_PATH = `ledgers/${LEDGER_ID}/transactions`;
const SUMMARY_PATH = `ledgers/${LEDGER_ID}/summaries/dashboard`;
const RECURRING_PATH = `ledgers/${LEDGER_ID}/recurring`;

/**
 * RECTIFIED STATS:
 * Uses original transaction amounts for the global ledger.
 * Mathematical integrity is maintained by (Expense - Settlement).
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

  // Bulk update participants
  const batch = writeBatch(db);
  Object.keys(myPersonalBalances).forEach(uid => {
    // Find the participant doc ID if different from uniqueId (assuming standard setup)
    // For simplicity, we assume this is handled by store or we just update local state logic outside
  });

  // Calculate Net
  const totals = {
    totalOwedToMe: 0,
    totalIOWE: 0
  };
  Object.values(myPersonalBalances).forEach(val => {
    if (val > 0) totals.totalOwedToMe += val;
    else totals.totalIOWE += Math.abs(val);
  });

  // Update Aggregate Doc
  const statsRef = doc(db, `ledgers/${LEDGER_ID}/aggregates/balances`);
  await setDoc(statsRef, {
    ...myPersonalBalances,
    ...totals,
    lastUpdated: Timestamp.now()
  });

  // Update legacy Summary for backward compatibility
  const summaryRef = doc(db, SUMMARY_PATH);
  await setDoc(summaryRef, {
    totalOwed: totals.totalOwedToMe,
    totalDebt: totals.totalIOWE,
    netBalance: totals.totalOwedToMe - totals.totalIOWE
  }, { merge: true });

  return true;
};

// HELPER: Parent stats calculation with partial settlement tracking
const updateParentStats = async (parentId) => {
  if (!parentId) return;
  const parentRef = doc(db, COLLECTION_PATH, parentId);
  const parentSnap = await getDoc(parentRef);
  if (!parentSnap.exists()) return;

  const colRef = collection(db, COLLECTION_PATH);
  // Find all children linked to this parent
  const q1 = query(colRef, where("parentTransactionId", "==", parentId), where("isDeleted", "==", false));
  const q2 = query(colRef, where("parentTransactionIds", "array-contains", parentId), where("isDeleted", "==", false));
  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  const parentData = parentSnap.data();
  const parentAmount = parseFloat(parentData.amount) || 0;
  const settlementDeficit = parseFloat(parentData.settlementDeficit) || 0;

  // 1. Determine Parent's Role (Base Balance)
  // If Expense: Starts as DEBT (Positive).
  // If Settlement with Deficit: Starts as DEBT (Deficit Amount).
  // If Settlement w/o Deficit: Starts as CREDIT (Negative Amount).
  let netBalance = 0;

  if (!parentData.isReturn) {
    // Expense: I owe this amount
    netBalance = parentAmount;
  } else if (settlementDeficit > 0) {
    // Partial Settlement: I owe the deficit
    netBalance = settlementDeficit;
  } else {
    // Overpaid/Regular Settlement: I have this credit (Negative represents Credit)
    netBalance = -parentAmount; // Credit is negative debt
  }

  // 2. Process Children (Adjust Balance)
  let totalSettled = 0; // Just for tracking magnitude of interaction

  // Combine all found children
  const children = [...snap1.docs, ...snap2.docs].map(d => d.data());

  children.forEach(childData => {
    // Determine the amount this child contributes to THIS parent link
    // If explicit link amount exists, use it. Otherwise use full amount (legacy).
    const link = childData.linkedTransactions?.find(l => l.id === parentId);
    const linkAmount = Math.abs(link ? link.amount : childData.amount);

    totalSettled += linkAmount;

    if (childData.isReturn) {
      // Child is a Payment (Settlement) -> REDUCE Debt (Subtract) / Increase Credit (More Negative)
      // e.g. Paying off an Expense or Deficit
      // Or adding to a credit pool (refund of refund?) -> Assume Payment direction reduces Debt.
      netBalance -= linkAmount;
    } else {
      // Child is an Expense -> INCREASE Debt (Add) / Consume Credit (Add to Negative)
      // e.g. Using an Overpayment to pay for a new expense
      netBalance += linkAmount;
    }
  });

  // 3. Derive Stats
  // If netBalance > 0, it's Debt Remaining.
  // If netBalance < 0, it's Credit Available (Overpaid).
  const remaining = Math.max(0, netBalance);
  const overpaid = Math.max(0, -netBalance);

  const updateData = {
    settledAmount: totalSettled,
    remainingAmount: remaining,
    overpaidAmount: overpaid,
    hasRefunds: true
  };

  // FORCE CLOSE LOGIC: If a transaction is linked/used, it is considered "rolled over" or "consumed".
  // The new transaction carries the updated balance (Deficit or Surplus).
  // Therefore, the old parent logic should strictly close it.

  // FIX: Improved settlement status logic
  if (Math.abs(netBalance) < 1) {
    // Net zero balance means fully settled/consumed
    updateData.settlementStatus = 'settled';
    updateData.remainingAmount = 0;
    updateData.overpaidAmount = 0;
  } else if (netBalance > 0) {
    updateData.settlementStatus = 'partial';
  } else {
    // Negative balance means it's still a credit pool (overpaid)
    updateData.settlementStatus = 'settled';
  }

  await updateDoc(parentRef, updateData);
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
    const finalDocData = {
      ...txnData,
      isDeleted: false,
      createdAt
    };

    // --- CHAINING SETTLEMENT LOGIC ---
    // If this is a return, judge deficit/credit based on explicit 'basketDiff' from UI if available.
    if (txnData.isReturn && txnData.basketDiff !== undefined) {
      const diff = parseFloat(txnData.basketDiff);
      // Positive Diff -> Deficit (Not enough paid)
      // Negative Diff -> Overpayment (Too much paid)
      // NOTE: diff is in PAISE. 5 = ₹0.05

      if (diff > 5) {
        finalDocData.settlementStatus = 'partial';
        finalDocData.settlementDeficit = diff;
        finalDocData.remainingAmount = diff;
        finalDocData.overpaidAmount = 0;
      } else if (diff < -5) {
        // Overpayment
        finalDocData.settlementStatus = 'settled';
        finalDocData.settlementDeficit = 0;
        finalDocData.remainingAmount = 0;
        finalDocData.overpaidAmount = Math.abs(diff);
      } else {
        // Exact Match
        finalDocData.settlementStatus = 'settled';
        finalDocData.remainingAmount = 0;
        finalDocData.overpaidAmount = 0;
      }
    }
    else if (txnData.isReturn && txnData.parentTransactionIds?.length > 0) {
      // Fallback: We need to fetch parents to know their outstanding amounts
      // Note: We use a blocking fetch here to ensure data integrity for the Chain
      const parentDocs = await Promise.all(
        txnData.parentTransactionIds.map(pid => getDoc(doc(db, COLLECTION_PATH, pid)))
      );

      let totalDebtToSettle = 0;
      parentDocs.forEach(p => {
        if (p.exists()) {
          const pData = p.data();
          // If parent is a Settlement, use its remaining deficit. If Expense, use remaining or amount.
          const pRem = pData.remainingAmount !== undefined ? pData.remainingAmount : pData.amount;
          totalDebtToSettle += (parseFloat(pRem) || 0);
        }
      });

      // Payment vs Debt
      const paymentAmount = parseFloat(txnData.amount) || 0;
      const deficit = totalDebtToSettle - paymentAmount;

      if (deficit > 1) { // 1 is tolerance for float math
        finalDocData.settlementStatus = 'partial';
        finalDocData.settlementDeficit = deficit;
        finalDocData.remainingAmount = deficit; // Initialize remaining with current deficit
      } else {
        finalDocData.settlementStatus = 'settled';
        finalDocData.remainingAmount = 0;
      }
    }

    const docRef = await addDoc(collection(db, COLLECTION_PATH), finalDocData);



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

    // 3. Map to Data
    const data = visibleSnapshots.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      data,
      lastDoc: visibleSnapshots.length > 0 ? visibleSnapshots[visibleSnapshots.length - 1] : null,
      hasMore: activeSnapshots.length > pageSize // Primitive check, or if we got full batch
    };
  } catch (error) {
    console.error("Pagination Fetch Error:", error);
    // Fallback?
    return { data: [], lastDoc: null, hasMore: false };
  }
};


// 1. Determine if a transaction is processed today (based on nextDueDate)
export const checkRecurringDue = (recurringData) => {
  if (!recurringData || !recurringData.nextDueDate) return false;

  const now = new Date();
  const nowMillis = now.getTime();
  const dueDateMillis = recurringData.nextDueDate.seconds * 1000; // Firestore Timestamp

  if (!dueDateMillis) return false;

  return dueDateMillis <= nowMillis;
};

// 1.5 Fetch all due recurring transactions
export const checkDueRecurring = async () => {
  try {
    const ref = collection(db, RECURRING_PATH);
    const q = query(ref, where('isActive', '==', true));
    const snap = await getDocs(q);

    const dueItems = [];
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (checkRecurringDue(data)) {
        dueItems.push(data);
      }
    });
    return dueItems;
  } catch (err) {
    console.error("Error fetching due recurring items:", err);
    return [];
  }
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

/**
 * DEEP REPAIR:
 * Iterates through every transaction and recalibrates its settlement metadata.
 * Use this to fix "Partial" statuses that don't match actual linked payments.
 */
export const repairAllTransactionStats = async () => {
  const colRef = collection(db, COLLECTION_PATH);
  const q = query(colRef, where("isDeleted", "==", false));
  const snap = await getDocs(q);
  const transactions = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const total = transactions.length;
  let processed = 0;

  // Process in sequence to avoid hitting Firestore rate limits for massive ledgers
  for (const txn of transactions) {
    // Only repair items that could have children (expenses) or are intended to be parents
    if (txn.type === 'expense' || txn.amount > 0) {
      await updateParentStats(txn.id);
    }
    processed++;
    if (processed % 10 === 0) console.log(`Repair progress: ${processed}/${total}`);
  }

  // Final step: Sync the global dashboard
  const participants = useAppStore.getState().rawParticipants;
  await rectifyAllStats(participants);

  return { processed };
};

