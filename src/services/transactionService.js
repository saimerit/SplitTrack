import { 
  addDoc, updateDoc, deleteDoc, doc, 
  collection, getDocs, query, where, getDoc 
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
    snap1.forEach(d => children.set(d.id, d.data()));
    snap2.forEach(d => children.set(d.id, d.data()));

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
  const docRef = await addDoc(collection(db, COLLECTION_PATH), txnData);
  
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

export const deleteTransaction = async (id, parentId) => {
  await deleteDoc(doc(db, COLLECTION_PATH, id));
  if (parentId) {
    await updateParentStats(parentId);
  }
};