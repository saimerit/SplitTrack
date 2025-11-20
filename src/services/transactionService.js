import { 
  addDoc, updateDoc, deleteDoc, doc, 
  collection, getDocs, query, where, getDoc, Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

const LEDGER_ID = 'main-ledger';
const COLLECTION_PATH = `ledgers/${LEDGER_ID}/transactions`;

// Helper: Recalculate parent stats (Feature 2 & 3 from HTML)
const updateParentStats = async (parentId) => {
  if (!parentId) return;
  
  try {
    const colRef = collection(db, COLLECTION_PATH);
    // Find all refunds linked to this parent
    const childrenQuery = query(colRef, where("parentTransactionId", "==", parentId));
    const childrenSnap = await getDocs(childrenQuery);
    
    let totalRefunds = 0;
    let lastRefundDate = null;
    
    childrenSnap.forEach(docSnap => {
      const data = docSnap.data();
      totalRefunds += (data.amount || 0); // Refunds are negative
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
  // 1. Add the document
  const docRef = await addDoc(collection(db, COLLECTION_PATH), txnData);
  
  // 2. Update parent if this is a refund
  if (txnData.parentTransactionId) {
    await updateParentStats(txnData.parentTransactionId);
  }
  
  return docRef.id;
};

export const updateTransaction = async (id, txnData, oldParentId) => {
  const docRef = doc(db, COLLECTION_PATH, id);
  await updateDoc(docRef, txnData);

  // 3. Robustness: Update BOTH old and new parents if changed
  if (txnData.parentTransactionId) {
    await updateParentStats(txnData.parentTransactionId);
  }
  if (oldParentId && oldParentId !== txnData.parentTransactionId) {
    await updateParentStats(oldParentId);
  }
};

export const deleteTransaction = async (id, parentId) => {
  await deleteDoc(doc(db, COLLECTION_PATH, id));
  
  if (parentId) {
    await updateParentStats(parentId);
  }
};