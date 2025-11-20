import { useState, useEffect, useCallback } from 'react';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import useAppStore from '../store/useAppStore';

const QUEUE_KEY = 'splitTrack_offline_queue';
const LEDGER_ID = 'main-ledger';

export const useOfflineQueue = () => {
  // FIX 1: Lazy initialization. Read LS immediately on load, not in useEffect.
  const [queueLength, setQueueLength] = useState(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return q.length;
    } catch {
      return 0;
    }
  });
  
  const [isSyncing, setIsSyncing] = useState(false);
  
  // FIX 2: Destructure showToast and actually use it below
  const { showToast } = useAppStore(); 

  const updateLength = useCallback(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      setQueueLength(q.length);
    } catch {
      setQueueLength(0);
    }
  }, []);

  // FIX 1 (Cont): useEffect now ONLY handles the event listener, no immediate setState
  useEffect(() => {
    window.addEventListener('storage', updateLength);
    return () => window.removeEventListener('storage', updateLength);
  }, [updateLength]);

  const addToQueue = (transactionData) => {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    const serializableData = {
      ...transactionData,
      // Handle timestamp conversion safely
      timestamp: transactionData.timestamp?.toMillis 
        ? transactionData.timestamp.toMillis() 
        : Date.now()
    };
    q.push(serializableData);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
    updateLength();
    // Optional: Show toast when saving offline
    showToast('Saved offline. Will sync when online.', false);
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
        const docData = {
          ...item,
          timestamp: Timestamp.fromMillis(item.timestamp)
        };
        await addDoc(collection(db, `ledgers/${LEDGER_ID}/transactions`), docData);
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

    // FIX 2 & 3: Using showToast and failCount
    if (failCount > 0) {
      showToast(`Synced ${successCount}, Failed ${failCount}. Retrying later.`, true);
    } else if (successCount > 0) {
      showToast(`Successfully synced ${successCount} transactions!`, false);
    }
  };

  return { queueLength, addToQueue, syncQueue, isSyncing };
};