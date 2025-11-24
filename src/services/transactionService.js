import { 
  addDoc, updateDoc, deleteDoc as firestoreDeleteDoc, doc, 
  collection, getDocs, query, where, getDoc, runTransaction, Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const LEDGER_ID = 'main-ledger';
const COLLECTION_PATH = `ledgers/${LEDGER_ID}/transactions`;

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
    // Filter out deleted children when recalculating stats
    snap1.forEach(d => { if(!d.data().isDeleted) children.set(d.id, d.data()); });
    snap2.forEach(d => { if(!d.data().isDeleted) children.set(d.id, d.data()); });

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
  }
};

export const addTransaction = async (txnData) => {
  const docRef = await addDoc(collection(db, COLLECTION_PATH), {
      ...txnData,
      isDeleted: false, // Feature 8: Initialize soft delete flag
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

      // Fix 3: Atomic check for dependencies
      // We query for ACTIVE children (not deleted ones)
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

      // Feature 8: Soft Delete
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
    throw e;
  }
};

// Feature 8: Restore Functionality
export const restoreTransaction = async (id) => {
    const txnRef = doc(db, COLLECTION_PATH, id);
    await updateDoc(txnRef, { isDeleted: false, deletedAt: null });
    // Recalculating parent stats might be needed here if amounts are involved
};

// Feature 8: Hard Delete (Permanent)
export const permanentDeleteTransaction = async (id) => {
    await firestoreDeleteDoc(doc(db, COLLECTION_PATH, id));
};