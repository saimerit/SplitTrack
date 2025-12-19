import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Import Shared Parser (Ensure path is correct relative to scripts folder)
import { parseCommandString } from '../src/utils/commandParser.js';

// --- SETUP ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, '../service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Error: 'service-account.json' not found in root.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// CONFIG: Set your Ledger/User ID here to fetch settings
const LEDGER_ID = 'main-ledger';
const SETTINGS_DOC_PATH = `ledgers/${LEDGER_ID}/settings/user_preferences`;

const run = async () => {
    const inputString = process.argv.slice(2).join(' ');

    if (!inputString.trim()) {
        console.log("Usage: splittrack amt:100 cat:Food ...");
        process.exit(1);
    }

    try {
        // 1. FETCH DEFAULTS FROM FIRESTORE
        // We try to fetch the settings document to apply your preferences
        let defaults = {};
        try {
            const settingsSnap = await db.doc(SETTINGS_DOC_PATH).get();
            if (settingsSnap.exists) {
                defaults = settingsSnap.data();
            }
        } catch (e) {
            // Silently fail default fetch if doc doesn't exist
        }

        // 2. PARSE COMMAND
        const rawData = parseCommandString(inputString, defaults);

        if (rawData.amount <= 0) {
            console.log("⚠️  Invalid Amount.");
            return;
        }

        // 3. PREPARE DATA
        const txnData = {
            amount: Math.round(rawData.amount * 100),
            expenseName: rawData.expenseName,
            category: rawData.category,
            type: rawData.type,
            dateString: rawData.date.toISOString().split('T')[0],
            timestamp: Timestamp.fromDate(rawData.date),
            payer: 'me',
            splits: { 'me': Math.round(rawData.amount * 100) },
            participants: [],
            groupId: rawData.group || 'personal',

            // New Fields
            tag: rawData.tag,
            place: rawData.place,
            mode: rawData.mode,

            isDeleted: false,
            source: 'local-terminal'
        };

        // 4. UPLOAD
        await db.collection(`ledgers/${LEDGER_ID}/transactions`).add(txnData);

        console.log(`✅ [SUCCESS]`);
        console.log(`   📝 ${txnData.expenseName}`);
        console.log(`   💰 ${rawData.amount}`);
        console.log(`   📂 ${txnData.category} | 🏷️ ${txnData.tag || '-'}`);
        console.log(`   📍 ${txnData.place || '-'} | 💳 ${txnData.mode || '-'}`);

    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
};

run();