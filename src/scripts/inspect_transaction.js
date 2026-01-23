// inspect_transaction.js
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { LEDGER_ID } from '../config/constants';

const inspect = async () => {
    const q = query(collection(db, `ledgers/${LEDGER_ID}/transactions`)); // Get all and filter locally for fuzzy match
    const snap = await getDocs(q);

    const matches = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => t.expenseName && t.expenseName.toLowerCase().includes('nutty'));

    console.log("Found matches:", JSON.stringify(matches, null, 2));
};

inspect();
