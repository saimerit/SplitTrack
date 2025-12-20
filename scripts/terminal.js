import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// Import Shared Parser
import { parseCommandString } from '../src/utils/commandParser.js';

// --- SETUP ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serviceAccountPath = path.join(__dirname, '../service-account.json');

if (!fs.existsSync(serviceAccountPath)) {
    console.error("Error: 'service-account.json' not found in root.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// CONFIG: Set your Ledger/User ID here
const LEDGER_ID = 'main-ledger';
const SETTINGS_DOC_PATH = `ledgers/${LEDGER_ID}/settings/user_preferences`;
const TRANSACTIONS_PATH = `ledgers/${LEDGER_ID}/transactions`;

// --- HELPER: Format Currency ---
const formatCurrency = (amountInPaise) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(amountInPaise / 100);
};

// --- COMMAND HANDLERS ---

// 1. HISTORY (ls)
const handleHistory = async (args) => {
    const limit = parseInt(args[0]) || 5;

    const snapshot = await db.collection(TRANSACTIONS_PATH)
        .where('isDeleted', '==', false)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

    if (snapshot.empty) {
        console.log("No transactions found.");
        return;
    }

    console.log(`\nLast ${snapshot.size} Transactions:\n${'─'.repeat(50)}`);
    snapshot.forEach(doc => {
        const t = doc.data();
        const amt = formatCurrency(t.amount);
        console.log(`  ${t.dateString}: ${amt} - ${t.expenseName} [${t.category}]`);
    });
    console.log('─'.repeat(50));
};

// 2. UNDO (undo)
const handleUndo = async () => {
    const snapshot = await db.collection(TRANSACTIONS_PATH)
        .where('isDeleted', '==', false)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log("Nothing to undo.");
        return;
    }

    const doc = snapshot.docs[0];
    const txn = doc.data();

    // Soft delete (mark as deleted)
    await db.collection(TRANSACTIONS_PATH).doc(doc.id).update({ isDeleted: true });

    console.log(`Undo: Deleted '${txn.expenseName}' (${formatCurrency(txn.amount)})`);
};

// 3. STATS (stats)
const handleStats = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const snapshot = await db.collection(TRANSACTIONS_PATH)
        .where('isDeleted', '==', false)
        .where('timestamp', '>=', Timestamp.fromDate(startOfMonth))
        .get();

    let totalSpent = 0;
    snapshot.forEach(doc => {
        totalSpent += doc.data().amount;
    });

    const monthName = now.toLocaleString('default', { month: 'long' });
    console.log(`\nMONTHLY SNAPSHOT (${monthName})\n${'─'.repeat(30)}`);
    console.log(`  Total Spent: ${formatCurrency(totalSpent)}`);
    console.log(`  Transactions: ${snapshot.size}`);
    console.log('─'.repeat(30));
};

// 4. HELP
const handleHelp = () => {
    console.log(`
╔══════════════════════════════════════════════════════╗
║        SplitTrack Terminal - Command Reference       ║
╠══════════════════════════════════════════════════════╣
║  TRANSACTIONS:                                       ║
║    amt:100 expn:Lunch c:Food                         ║
║    amt:500 expn:Dinner c:Food m:UPI dt:yesterday     ║
║                                                      ║
║  MANAGEMENT:                                         ║
║    ls [n]   - Show last n transactions               ║
║    undo     - Delete your last transaction           ║
║    stats    - Show this month's spending             ║
║    help     - Show this help                         ║
║                                                      ║
║  ALIASES:                                            ║
║    amt/a = amount    expn/n = name    c/cat = cat    ║
║    p = place   m = mode   dt = date   g = group      ║
║    by = payer  inc = include me                      ║
╚══════════════════════════════════════════════════════╝
`);
};

// --- MAIN RUNNER ---
const run = async () => {
    const args = process.argv.slice(2);
    const inputString = args.join(' ');

    if (!inputString.trim()) {
        handleHelp();
        process.exit(0);
    }

    try {
        const cmd = args[0].toLowerCase();

        // Intercept special commands
        if (['ls', 'list', 'history'].includes(cmd)) {
            await handleHistory(args.slice(1));
            return;
        }

        if (cmd === 'undo') {
            await handleUndo();
            return;
        }

        if (['stats', 'status', 'report'].includes(cmd)) {
            await handleStats();
            return;
        }

        if (cmd === 'help') {
            handleHelp();
            return;
        }

        // Standard transaction parsing
        let defaults = {};
        try {
            const settingsSnap = await db.doc(SETTINGS_DOC_PATH).get();
            if (settingsSnap.exists) {
                defaults = settingsSnap.data();
            }
        } catch (e) {
            // Silently fail default fetch
        }

        const rawData = parseCommandString(inputString, defaults);

        if (rawData.amount <= 0) {
            console.log("Invalid amount. Amount must be greater than 0.");
            return;
        }

        const txnData = {
            amount: Math.round(rawData.amount * 100),
            expenseName: rawData.expenseName,
            category: rawData.category,
            type: rawData.type,
            dateString: rawData.date.toISOString().split('T')[0],
            timestamp: Timestamp.fromDate(rawData.date),
            payer: rawData.payer || 'me',
            splits: { [rawData.payer || 'me']: Math.round(rawData.amount * 100) },
            participants: [],
            groupId: rawData.group || 'personal',
            tag: rawData.tag,
            place: rawData.place,
            modeOfPayment: rawData.mode,
            isDeleted: false,
            source: 'local-terminal'
        };

        await db.collection(TRANSACTIONS_PATH).add(txnData);

        console.log(`\nLogged: ${txnData.expenseName} (${formatCurrency(txnData.amount)}) [${txnData.category}]`);
        if (txnData.tag) console.log(`  Tag: ${txnData.tag}`);
        if (txnData.place) console.log(`  Place: ${txnData.place}`);
        if (txnData.modeOfPayment) console.log(`  Mode: ${txnData.modeOfPayment}`);

    } catch (error) {
        console.error(`Error: ${error.message}`);
    }
};

run();