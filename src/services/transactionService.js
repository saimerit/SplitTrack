import { 
  addDoc, updateDoc, deleteDoc as firestoreDeleteDoc, doc, 
  collection, getDocs, query, where, getDoc, runTransaction, Timestamp, writeBatch,
  limit, startAfter, orderBy // Added imports for pagination
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
    // Filter out deleted children
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
    
    // 1. Base Query: Filter soft-deleted items AND sort by time
    // NOTE: This specific line REQUIRES the Index mentioned above.
    let q = query(colRef, where("isDeleted", "==", false), orderBy('timestamp', 'desc'));

    // 2. Apply Filters
    if (filters.tag) {
      q = query(q, where('tag', '==', filters.tag));
    }

    if (filters.date) {
      const start = new Date(filters.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.date);
      end.setHours(23, 59, 59, 999);
      
      // FIX: Use .getTime() because you store dates as Numbers (milliseconds)
      q = query(q, 
        where('timestamp', '>=', start.getTime()), 
        where('timestamp', '<=', end.getTime())
      );
    } else if (filters.month) {
      const [year, month] = filters.month.split('-');
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      
      // FIX: Use .getTime() here too
      q = query(q, 
        where('timestamp', '>=', start.getTime()), 
        where('timestamp', '<=', end.getTime())
      );
    }

    // 3. Apply Pagination
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    q = query(q, limit(pageSize));

    const snapshot = await getDocs(q);
    
    return {
      data: snapshot.docs.map(d => ({ id: d.id, ...d.data() })),
      lastDoc: snapshot.docs[snapshot.docs.length - 1],
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (error) {
    console.error("Pagination Error:", error);
    // If you see the index error, throwing it ensures the UI knows something went wrong
    throw error;
  }
};