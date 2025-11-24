import { useState, useEffect, useCallback } from 'react';
import { setDoc, doc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import useAppStore from '../store/useAppStore';

const QUEUE_KEY = 'splitTrack_offline_queue';
const LEDGER_ID = 'main-ledger';

export const useOfflineQueue = () => {
  const [queueLength, setQueueLength] = useState(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return q.length;
    } catch {
      return 0;
    }
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  const { showToast } = useAppStore(); 

  const updateLength = useCallback(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      setQueueLength(q.length);
    } catch {
      setQueueLength(0);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('storage', updateLength);
    return () => window.removeEventListener('storage', updateLength);
  }, [updateLength]);

  const addToQueue = (transactionData) => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      
      // FIX 2: Generate ID immediately to prevent duplicates during sync retry
      const newDocRef = doc(collection(db, `ledgers/${LEDGER_ID}/transactions`));
      
      const serializableData = {
        ...transactionData,
        id: newDocRef.id, // Store the pre-generated ID
        timestamp: transactionData.timestamp?.toMillis 
          ? transactionData.timestamp.toMillis() 
          : Date.now()
      };
      
      q.push(serializableData);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
      updateLength();
      showToast('Saved offline. Will sync when online.', false);
    } catch (error) {
      console.error("Offline save failed:", error);
      showToast('Storage full! Cannot save offline transaction.', true);
    }
  };

  const syncQueue = async () => {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (q.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;
    const newQueue = [];

    for (const item of q) {
      try {
        const docData = { ...item };
        // Remove ID from data payload as it goes into the doc ref
        const docId = docData.id;
        delete docData.id;
        
        docData.timestamp = Timestamp.fromMillis(item.timestamp);
        
        // FIX 2: Use setDoc with the specific ID we generated earlier
        await setDoc(doc(db, `ledgers/${LEDGER_ID}/transactions`, docId), docData);
        successCount++;
      } catch (e) {
        console.error("Sync failed for item", e);
        newQueue.push(item);
        failCount++;
      }
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
    updateLength();
    setIsSyncing(false);

    if (failCount > 0) {
      showToast(`Synced ${successCount}, Failed ${failCount}. Retrying later.`, true);
    } else if (successCount > 0) {
      showToast(`Successfully synced ${successCount} transactions!`, false);
    }
  };

  return { queueLength, addToQueue, syncQueue, isSyncing };
};