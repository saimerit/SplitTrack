import { useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, doc, where, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import useAppStore from '../store/useAppStore';
import { useAuth } from './useAuth';
import { runLedgerIntegrityChecks } from '../utils/integrityChecks';

import { LEDGER_ID } from '../config/constants';

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
    setGroups, // New Action
    setUserSettings,
    setDeletedTransactions, // For Trash feature
    setLoading
  } = useAppStore();

  useEffect(() => {
    if (!isAllowed) return;

    // OPTIMIZED QUERY: Sync Current Year to ensure balance integrity while avoiding full history
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const startTimestamp = Timestamp.fromMillis(startOfYear.getTime());

    const refs = {
      participants: query(collection(db, `ledgers/${LEDGER_ID}/participants`), orderBy('uniqueId')),
      transactions: query(
        collection(db, `ledgers/${LEDGER_ID}/transactions`),
        where('timestamp', '>=', startTimestamp),
        orderBy('timestamp', 'desc')
      ),
      categories: query(collection(db, `ledgers/${LEDGER_ID}/categories`), orderBy('name')),
      places: query(collection(db, `ledgers/${LEDGER_ID}/places`), orderBy('name')),
      tags: query(collection(db, `ledgers/${LEDGER_ID}/tags`), orderBy('name')),
      modes: query(collection(db, `ledgers/${LEDGER_ID}/modesOfPayment`), orderBy('name')),
      templates: query(collection(db, `ledgers/${LEDGER_ID}/templates`), orderBy('name')),
      goals: query(collection(db, `ledgers/${LEDGER_ID}/goals`), orderBy('name')),
      groups: query(collection(db, `ledgers/${LEDGER_ID}/groups`), orderBy('name')), // New Collection
      settings: doc(db, `ledgers/${LEDGER_ID}`),
    };

    const unsubs = [
      // Sync raw participants
      onSnapshot(refs.participants, s => setParticipants(s.docs.map(d => ({ id: d.id, ...d.data() })))),

      // Sync raw transactions (Feature 8: Filter out soft-deleted)
      onSnapshot(refs.transactions, s => {
        const allTxns = s.docs.map(d => ({ id: d.id, ...d.data() }));
        const activeTxns = allTxns.filter(t => !t.isDeleted);
        const deletedTxns = allTxns.filter(t => t.isDeleted); // For Trash feature

        setTransactions(activeTxns); // Store will handle group filtering
        setDeletedTransactions(deletedTxns); // Store deleted for Trash

        // Integrity Checks
        setTimeout(() => {
          const currentParticipants = useAppStore.getState().rawParticipants; // Check against raw
          if (currentParticipants.length > 0) {
            runLedgerIntegrityChecks(activeTxns, currentParticipants);
          }
        }, 1000);
      }),

      onSnapshot(refs.categories, s => setCategories(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(refs.places, s => setPlaces(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(refs.tags, s => setTags(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(refs.modes, s => setModes(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(refs.templates, s => setTemplates(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(refs.goals, s => setGoals(s.docs.map(d => ({ id: d.id, ...d.data() })))),
      onSnapshot(refs.groups, s => setGroups(s.docs.map(d => ({ id: d.id, ...d.data() })))), // New Sync

      onSnapshot(refs.settings, s => {
        if (s.exists()) setUserSettings(s.data());
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
    setGroups,
    setUserSettings,
    setDeletedTransactions,
    setLoading
  ]);
};