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
    // PREFER initialOverpaidAmount if available to support reversion
    const baseCredit = parentData.initialOverpaidAmount !== undefined
      ? parentData.initialOverpaidAmount
      : (parentData.overpaidAmount !== undefined ? parentData.overpaidAmount : -parentAmount);

    netBalance = baseCredit; // Should be negative
  }

  // 2. Process Children (Adjust Balance)
  let totalSettled = 0; // Just for tracking magnitude of interaction

  // Combine all found children
  const children = [...snap1.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() }));

  // ALWAYS reinitialize participantRemaining from splits to ensure proper recalculation
  // This is critical for deletion scenarios where we need to "forget" the deleted child's effect
  const participantRemaining = {};
  const participantStatuses = {};

  if (parentData.splits) {
    Object.entries(parentData.splits).forEach(([uid, share]) => {
      if (uid !== 'me' && share > 0) {
        participantRemaining[uid] = share;
        participantStatuses[uid] = 'pending';
      }
    });
  }



  // NEW: For Settlement Parents, initialize participantOverpaid bucket for consumption tracking
  const participantOverpaid = {};
  if (parentData.isReturn) {
    const initialMap = parentData.initialParticipantOverpaid || parentData.participantOverpaid || {};
    Object.entries(initialMap).forEach(([uid, amt]) => {
      participantOverpaid[uid] = amt; // Should be negative
    });
  }

  // Capture stable starting balance for logic checks
  const startBalance = netBalance;

  children.forEach(childData => {
    // Determine the amount this child contributes to THIS parent link
    // If explicit link amount exists, use it. Otherwise use full amount (legacy).
    const link = childData.linkedTransactions?.find(l => l.id === parentId);
    const linkAmount = Math.abs(link ? link.amount : childData.amount);

    totalSettled += linkAmount;

    if (childData.isReturn) {
      // Child is a Payment (Settlement)

      // CRITICAL LOGIC FIX:
      // If Parent is an Expense (Debt) -> Child Settlement REDUCES Debt (Standard Payment). netBalance -= linkAmount.
      // If Parent is a Settlement (Credit) -> Child Settlement CONSUMES Credit (Usage). netBalance += linkAmount.

      // CRITICAL LOGIC FIX:
      // Use the STARTING BALANCE (baseCredit) to determine the nature of the parent.
      // If baseCredit is NEGATIVE, it's a CREDIT bucket. Usage should ADD (Consume towards 0).
      // If baseCredit is POSITIVE, it's a DEBT bucket. Usage should SUBTRACT (Pay towards 0).

      const isCreditBucket = startBalance < 0; // Check sign of starting balance

      if (isCreditBucket) {
        // Parent is Credit (-20). Child uses it (5). Result should be -15.
        // -20 + 5 = -15.
        netBalance += linkAmount;
      } else {
        // Parent is Expense OR Deficit Settlement (100). Child pays it (20). Result should be 80.
        // 100 - 20 = 80.
        netBalance -= linkAmount;
      }

      // NEW: Per-participant bucket update
      // Identify the settling participant - who is paying back
      const settlingParticipant = childData.payer !== 'me' ? childData.payer : childData.participants?.[0];

      if (settlingParticipant && participantRemaining[settlingParticipant] !== undefined) {
        const originalBucket = parentData.splits?.[settlingParticipant] || 0;

        // Subtract the link amount from remaining
        // Subtract the link amount from remaining
        let newRem;
        // Use consistent logic: if global bucket is credit, participant bucket is also credit
        if (startBalance < 0) {
          // Credit Consumption: -20 + 5 = -15.
          newRem = participantRemaining[settlingParticipant] + linkAmount;
          // Cap at 0 (can't go positive)
          if (newRem > 0) newRem = 0;
        } else {
          // Debt Payment: 100 - 20 = 80.
          newRem = participantRemaining[settlingParticipant] - linkAmount;
          // Cap at 0 - Parent doesn't track overpayments (credit stays on settlement)
          if (newRem < 0) newRem = 0;
        }

        participantRemaining[settlingParticipant] = newRem;

        // Determine participant's status
        if (newRem <= 1) {
          // Fully settled (within tolerance)
          participantStatuses[settlingParticipant] = 'settled';
        } else {
          // Still has remaining debt
          participantStatuses[settlingParticipant] = 'partial';
        }
      }
    } else {
      // Child is an Expense -> INCREASE Debt (Add) / Consume Credit (Add to Negative)
      // e.g. Using an Overpayment to pay for a new expense
      netBalance += linkAmount;

      // Update participantOverpaid consumption (if this is a settlement parent)
      if (parentData.isReturn) {
        // Identify who consumed the credit (the payer of the expense, usually 'me' using the credit? Or the counterparty?)
        // If I am using a credit to pay for an expense, I am "Payer".
        // Actually, if I have a credit with Bob, and I record an expense with Bob, 
        // I am usually "Payer" (I paid), but I link the credit to reduce what he owes me?
        // OR Bob pays and links the credit to reduce what I owe him?

        // Simply: The credit holder consumes it.
        // If parent is "owed_to_me" (I hold credit), then I consume it.
        // If parent is "owed_by_me" (They hold credit), they consume it.

        // For simplicity, we just reduce the bucket of the settling participant if they match.
        // In settlements, there is usually only one counterparty.
        const participantId = childData.payer !== 'me' ? childData.payer : childData.participants?.[0];

        // If we can't find specific participant or simple 1-on-1, try single key
        const targetKey = participantId || Object.keys(participantOverpaid)[0];

        if (targetKey && participantOverpaid[targetKey] !== undefined) {
          // Add positive linkAmount to Negative credit (bringing it closer to 0)
          let newCredit = participantOverpaid[targetKey] + linkAmount;
          if (newCredit > 0) newCredit = 0; // Cap at 0
          participantOverpaid[targetKey] = newCredit;
        }
      }
    }
  });

  // 3. Derive Stats
  // If netBalance > 0, it's Debt Remaining.
  // If netBalance <= 0, the expense is fully settled (any overpayment stays in the settlement doc, not here)
  const remaining = Math.max(0, netBalance);

  const updateData = {
    settledAmount: totalSettled,
    remainingAmount: remaining,
    hasRefunds: true,
    participantRemaining,
    participantStatuses,
    // Update overpaid amount if it tracks credit (Settlements)
    ...(parentData.isReturn ? {
      overpaidAmount: Math.min(0, netBalance), // Ensure it doesn't go positive
      participantOverpaid
    } : {})
  };

  // Settlement status logic - parent only tracks if debt is remaining
  if (remaining <= 1) {
    // Fully settled or overpaid - expense is closed
    updateData.settlementStatus = 'settled';
    updateData.remainingAmount = 0;
  } else {
    // Still has remaining debt
    updateData.settlementStatus = 'partial';
    updateData.remainingAmount = remaining;
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

    // NEW: Per-participant bucket initialization for expenses with splits
    if (!txnData.isReturn && txnData.splits) {
      const participantRemaining = {};
      const participantStatuses = {};

      Object.entries(txnData.splits).forEach(([uid, share]) => {
        if (uid !== 'me' && share > 0) {
          participantRemaining[uid] = share;
          participantStatuses[uid] = 'pending';
        }
      });

      // Only add if there are non-me participants
      if (Object.keys(participantRemaining).length > 0) {
        finalDocData.participantRemaining = participantRemaining;
        finalDocData.participantStatuses = participantStatuses;
      }
    }

    // --- CHAINING SETTLEMENT LOGIC ---
    // If this is a return, judge deficit/credit based on explicit 'basketDiff' from UI if available.
    if (txnData.isReturn && txnData.basketDiff !== undefined) {
      const diff = parseFloat(txnData.basketDiff);
      // basketDiff = amountPaid - linkedTotal (in PAISE)
      // POSITIVE Diff -> Overpayment (Paid more than owed)
      // NEGATIVE Diff -> Deficit (Paid less than owed)
      // NOTE: 5 paise tolerance

      // Identify the settling participant for per-participant tracking
      const settlingParticipant = txnData.payer !== 'me' ? txnData.payer : txnData.participants?.[0];

      if (diff > 5) {
        // OVERPAYMENT: amountPaid > linkedTotal
        // For settlements, there's only one participant - just store diff in overpaidAmount
        finalDocData.settlementStatus = 'settled';
        finalDocData.settlementDeficit = 0;
        finalDocData.remainingAmount = 0;
        finalDocData.overpaidAmount = -diff; // Store as negative per user request

        // Track per-participant overpaid status
        if (settlingParticipant) {
          finalDocData.participantRemaining = { [settlingParticipant]: -diff }; // Negative = credit
          finalDocData.participantStatuses = { [settlingParticipant]: 'overpaid' };
          finalDocData.participantOverpaid = { [settlingParticipant]: -diff }; // Store as negative

          // Store immutable initial values for reversion logic
          finalDocData.initialOverpaidAmount = -diff;
          finalDocData.initialParticipantOverpaid = { [settlingParticipant]: -diff };
        }
      } else if (diff < -5) {
        // DEFICIT: amountPaid < linkedTotal (paid less than owed)
        const deficitAmt = Math.abs(diff); // Make positive for display
        finalDocData.settlementStatus = 'partial';
        finalDocData.settlementDeficit = deficitAmt;
        finalDocData.remainingAmount = deficitAmt;
        finalDocData.overpaidAmount = 0;

        // Track per-participant partial status
        if (settlingParticipant) {
          finalDocData.participantRemaining = { [settlingParticipant]: deficitAmt };
          finalDocData.participantStatuses = { [settlingParticipant]: 'partial' };
        }
      } else {
        // Exact Match (within 5 paise tolerance)
        finalDocData.settlementStatus = 'settled';
        finalDocData.remainingAmount = 0;
        finalDocData.overpaidAmount = 0;

        // Track per-participant settled status
        if (settlingParticipant) {
          finalDocData.participantRemaining = { [settlingParticipant]: 0 };
          finalDocData.participantStatuses = { [settlingParticipant]: 'settled' };
        }
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

          // Check if parent is a Credit Settlement (Positive Asset / Negative Debt)
          if (pData.isReturn && pData.overpaidAmount < -1) {
            // It is a Credit (e.g. -20). Add it to totalDebt (effectively reducing debt).
            // 50 (Debt) + -20 (Credit) = 30 (Net Debt).
            totalDebtToSettle += pData.overpaidAmount;
          } else {
            // It is a Debt (Expense or Deficit Settlement)
            const pRem = pData.remainingAmount !== undefined ? pData.remainingAmount : pData.amount;
            totalDebtToSettle += (parseFloat(pRem) || 0);
          }
        }
      });

      // Payment vs Debt
      const paymentAmount = parseFloat(txnData.amount) || 0;
      const deficit = totalDebtToSettle - paymentAmount;

      // Identify the settling participant for per-participant tracking
      const settlingParticipant = txnData.payer !== 'me' ? txnData.payer : txnData.participants?.[0];

      if (deficit > 5) { // 5 paise tolerance
        finalDocData.settlementStatus = 'partial';
        finalDocData.settlementDeficit = deficit;
        finalDocData.remainingAmount = deficit; // Initialize remaining with current deficit
        finalDocData.overpaidAmount = 0;

        if (settlingParticipant) {
          finalDocData.participantRemaining = { [settlingParticipant]: deficit };
          finalDocData.participantStatuses = { [settlingParticipant]: 'partial' };
        }
      } else if (deficit < -5) {
        // OVERPAYMENT: amountPaid > linkedTotal
        const overpaid = Math.abs(deficit);
        finalDocData.settlementStatus = 'settled';
        finalDocData.remainingAmount = 0;
        finalDocData.overpaidAmount = -overpaid; // Store as negative

        if (settlingParticipant) {
          finalDocData.participantRemaining = { [settlingParticipant]: -overpaid }; // Negative = credit
          finalDocData.participantStatuses = { [settlingParticipant]: 'overpaid' };
          finalDocData.participantOverpaid = { [settlingParticipant]: -overpaid }; // Store as negative

          // Store immutable initial values for reversion logic
          finalDocData.initialOverpaidAmount = -overpaid;
          finalDocData.initialParticipantOverpaid = { [settlingParticipant]: -overpaid };
        }
      } else {
        // Exact Match
        finalDocData.settlementStatus = 'settled';
        finalDocData.remainingAmount = 0;
        finalDocData.overpaidAmount = 0;

        if (settlingParticipant) {
          finalDocData.participantRemaining = { [settlingParticipant]: 0 };
          finalDocData.participantStatuses = { [settlingParticipant]: 'settled' };
        }
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
    // Store the transaction data before deletion to get all parent IDs
    const txnSnap = await getDoc(txnRef);
    const txnData = txnSnap.exists() ? txnSnap.data() : null;

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

    // Collect ALL parent IDs that need updating (handles multi-parent settlements)
    const allParentIds = new Set();
    if (parentId) allParentIds.add(parentId);
    if (txnData?.parentTransactionId) allParentIds.add(txnData.parentTransactionId);
    if (txnData?.parentTransactionIds?.length > 0) {
      txnData.parentTransactionIds.forEach(pid => allParentIds.add(pid));
    }
    // Also check linkedTransactions for parent IDs
    if (txnData?.linkedTransactions?.length > 0) {
      txnData.linkedTransactions.forEach(link => allParentIds.add(link.id));
    }

    // Update all affected parents - this will recalculate participantRemaining from scratch
    // excluding the now-deleted child, effectively reverting the parent to pre-settlement state
    if (allParentIds.size > 0) {
      await Promise.all([...allParentIds].map(pid => updateParentStats(pid)));
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

