import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// 1. ROBUST PATH RESOLUTION
// Get the absolute path of THIS script file
const __filename = fileURLToPath(import.meta.url);
// Get the directory of this script (the 'scripts' folder)
const __dirname = path.dirname(__filename);
// Look for the JSON file one level up (in the root)
const serviceAccountPath = path.join(__dirname, '../service-account.json');

// Debugging: Print where it is looking (Optional, remove later)
// console.log("Looking for key at:", serviceAccountPath);

if (!fs.existsSync(serviceAccountPath)) {
    console.error("❌ Error: 'service-account.json' not found at:");
    console.error(serviceAccountPath);
    console.error("Make sure the file is in your PROJECT ROOT folder.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

// Initialize
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const LEDGER_ID = 'main-ledger'; 

const run = async () => {
    const args = process.argv.slice(2);
    const cmd = args[0]?.toLowerCase();
    const rest = args.slice(1);

    if (!cmd) {
        console.log("Usage: splittrack <exp|split> ...");
        process.exit(1);
    }

    try {
        if (cmd === 'exp' || cmd === 'add' || cmd === 'a') {
            const amount = parseFloat(rest[0]);
            const name = rest[1]?.replace(/_/g, ' ') || 'Unknown';
            
            if (isNaN(amount)) throw new Error("Invalid Amount");

            const docData = {
                amount: Math.round(amount * 100),
                expenseName: name,
                category: 'Terminal',
                type: 'expense',
                dateString: new Date().toISOString().split('T')[0],
                timestamp: Timestamp.now(),
                payer: 'me',
                splits: { 'me': Math.round(amount * 100) },
                participants: [],
                groupId: 'personal',
                isDeleted: false,
                source: 'local-terminal'
            };

            await db.collection(`ledgers/${LEDGER_ID}/transactions`).add(docData);
            console.log(`✅ [SUCCESS] Added "${name}" for ${amount}`);
        } 
        else {
            console.log(`❌ Unknown command: ${cmd}`);
        }
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        process.exit(1);
    }
};

run();