import { useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import useAppStore from '../store/useAppStore';
import { useAuth } from './useAuth'; 
import { runLedgerIntegrityChecks } from '../utils/integrityChecks';

const LEDGER_ID = 'main-ledger';

export const useFirestoreSync = () => {
  const { isAllowed } = useAuth();

  const {
    setParticipants,
    setTransactions,
    setCategories,
    setPlaces,
    setTags,
    setModes,
    setTemplates,
    setGoals,
    setUserSettings,
    setLoading
  } = useAppStore();

  useEffect(() => {
    if (!isAllowed) return;

    const refs = {
      participants: query(collection(db, `ledgers/${LEDGER_ID}/participants`), orderBy('uniqueId')),
      transactions: query(collection(db, `ledgers/${LEDGER_ID}/transactions`), orderBy('timestamp', 'desc')),
      categories: query(collection(db, `ledgers/${LEDGER_ID}/categories`), orderBy('name')),
      places: query(collection(db, `ledgers/${LEDGER_ID}/places`), orderBy('name')),
      tags: query(collection(db, `ledgers/${LEDGER_ID}/tags`), orderBy('name')),
      modes: query(collection(db, `ledgers/${LEDGER_ID}/modesOfPayment`), orderBy('name')),
      templates: query(collection(db, `ledgers/${LEDGER_ID}/templates`), orderBy('name')),
      goals: query(collection(db, `ledgers/${LEDGER_ID}/goals`), orderBy('name')),
      settings: doc(db, `ledgers/${LEDGER_ID}`),
    };

    const unsubs = [
      onSnapshot(refs.participants, s => setParticipants(s.docs.map(d => ({id: d.id, ...d.data()})))),
      
      // Feature 8: Filter out soft-deleted transactions from main state
      onSnapshot(refs.transactions, s => {
        const allTxns = s.docs.map(d => ({id: d.id, ...d.data()}));
        const activeTxns = allTxns.filter(t => !t.isDeleted);
        setTransactions(activeTxns);
        
        // Run checks after a brief delay
        setTimeout(() => {
            const currentParticipants = useAppStore.getState().participants;
            if (currentParticipants.length > 0) {
                runLedgerIntegrityChecks(activeTxns, currentParticipants);
            }
        }, 1000);
      }),

      onSnapshot(refs.categories, s => setCategories(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(refs.places, s => setPlaces(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(refs.tags, s => setTags(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(refs.modes, s => setModes(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(refs.templates, s => setTemplates(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(refs.goals, s => setGoals(s.docs.map(d => ({id: d.id, ...d.data()})))),
      onSnapshot(refs.settings, s => {
        if(s.exists()) setUserSettings(s.data());
        setLoading(false);
      })
    ];

    return () => unsubs.forEach(u => u());
  }, [
    isAllowed, 
    setParticipants, 
    setTransactions, 
    setCategories, 
    setPlaces, 
    setTags, 
    setModes, 
    setTemplates, 
    setGoals, 
    setUserSettings, 
    setLoading
  ]);
};