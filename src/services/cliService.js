// src/services/cliService.js
import useAppStore from '../store/useAppStore';
import { addTransaction, deleteTransaction } from './transactionService';
import { Timestamp } from 'firebase/firestore';
import { normalize, formatCurrency } from '../utils/formatters';
import { parseCommandString } from '../utils/commandParser';

// --- HELPERS ---
const resolveGroup = (inputName, groups) => {
    if (!inputName || inputName === 'personal') return 'personal';
    const clean = inputName.replace('@', '');
    const found = groups.find(g => normalize(g.name) === normalize(clean));
    return found ? found.id : 'personal';
};

const resolveCategory = (input, categories) => {
    if (!input) return 'General';
    const match = categories.find(c => normalize(c.name) === normalize(input));
    return match ? match.name : input;
};

const resolveParticipants = (groupInput, allGroups, participants) => {
    if (!groupInput || groupInput === 'personal') return [];
    const clean = groupInput.replace('@', '');

    // 1. Check Group
    const foundGroup = allGroups.find(g => normalize(g.name) === normalize(clean));
    if (foundGroup) return foundGroup.members;

    // 2. Check Person
    const foundPerson = participants.find(p =>
        normalize(p.name) === normalize(clean) || normalize(p.uniqueId) === normalize(clean)
    );
    return foundPerson ? [foundPerson.uniqueId] : [];
};

const resolvePayer = (inputName, participants) => {
    if (!inputName || inputName === 'me') return 'me';
    const clean = inputName.replace('@', '');
    const found = participants.find(p =>
        normalize(p.name) === normalize(clean) || normalize(p.uniqueId) === normalize(clean)
    );
    return found ? found.uniqueId : 'me';
};

// --- COMMAND HANDLERS ---

// 1. HISTORY (ls)
const handleHistory = (args, transactions) => {
    const limit = parseInt(args[0]) || 5;

    const sorted = [...transactions].sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
        return tB - tA;
    });

    const recent = sorted.slice(0, limit);
    if (recent.length === 0) return { success: true, message: "No transactions found." };

    const lines = recent.map(t => {
        const amt = formatCurrency(t.amount);
        return `• ${t.dateString}: ${amt} - ${t.expenseName} [${t.category}]`;
    });

    return {
        success: true,
        message: `Last ${limit} Transactions:\n${lines.join('\n')}`
    };
};

// 2. UNDO (undo)
const handleUndo = async (currentUser, transactions) => {
    const myTxns = transactions.filter(t => t.createdBy === currentUser?.uid && !t.isDeleted);
    if (myTxns.length === 0) return { success: false, message: "Nothing to undo." };

    myTxns.sort((a, b) => {
        const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp).getTime();
        const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp).getTime();
        return tB - tA;
    });

    const lastTxn = myTxns[0];

    try {
        await deleteTransaction(lastTxn.id);
        return {
            success: true,
            message: `Undo: Deleted '${lastTxn.expenseName}' (${formatCurrency(lastTxn.amount)})`
        };
    } catch (error) {
        return { success: false, message: "Undo failed: " + error.message };
    }
};

// 3. STATS (stats)
const handleStats = (transactions) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthTxns = transactions.filter(t => {
        const d = new Date(t.dateString);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear && !t.isDeleted;
    });

    const totalSpent = thisMonthTxns.reduce((sum, t) => sum + t.amount, 0);
    const count = thisMonthTxns.length;

    return {
        success: true,
        message: `MONTHLY SNAPSHOT (${now.toLocaleString('default', { month: 'long' })})\n` +
            `   Total Spent: ${formatCurrency(totalSpent)}\n` +
            `   Transactions: ${count}`
    };
};

// 4. QUICK ADD (quick / q)
const handleQuick = async (args, templates, currentUser) => {
    const list = templates || [];

    if (list.length === 0) {
        return { success: false, message: "No templates found. Go to 'Templates' page to create one." };
    }

    // CASE 1: User typed "quick" -> List them
    if (args.length === 0) {
        const lines = list.map((t, index) => {
            const amt = formatCurrency(t.amount);
            const pinIcon = t.isPinned ? "★ " : "";
            return `[${index + 1}] ${pinIcon}${t.expenseName} (${amt}) - ${t.category}`;
        });
        return {
            success: true,
            message: `Available Templates:\n${lines.join('\n')}\n\nTo add one, type: quick <number> (e.g., 'quick 1')`
        };
    }

    // CASE 2: User typed "quick 1" -> Add it
    const index = parseInt(args[0]) - 1;
    if (isNaN(index) || index < 0 || index >= list.length) {
        return { success: false, message: `Invalid number. Choose between 1 and ${list.length}.` };
    }

    const template = list[index];
    const payer = template.payer || 'me';

    // Construct new transaction from template
    const txnData = {
        ...template,
        dateString: new Date().toISOString().split('T')[0],
        timestamp: Timestamp.now(),
        createdBy: currentUser.uid,
        isDeleted: false,
        source: 'quick-add-cli',
        payer: payer
    };

    // Ensure splits is properly set - if no splits or empty, assign full amount to payer
    if (!txnData.splits || Object.keys(txnData.splits).length === 0) {
        txnData.splits = { [payer]: txnData.amount };
    }

    // Remove template-specific fields
    delete txnData.id;
    delete txnData.isPinned;

    try {
        const id = await addTransaction(txnData);
        return {
            success: true,
            message: `Quick Added: ${txnData.expenseName} (${formatCurrency(txnData.amount)})`,
            data: { id }
        };
    } catch (error) {
        return { success: false, message: "Failed to add: " + error.message };
    }
};

export const executeCommand = async (commandString, interactiveData = null) => {
    const state = useAppStore.getState();
    const { currentUser, categories, participants, userSettings, groups, transactions, templates } = state;

    if (!currentUser) return { success: false, message: "Unauthorized: Please log in." };

    // 1. Resume Interactive Session
    if (interactiveData) {
        const id = await addTransaction(interactiveData);
        return {
            success: true,
            message: `Logged: ${interactiveData.expenseName} (${formatCurrency(interactiveData.amount)})`,
            data: { id }
        };
    }

    try {
        const parts = commandString.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();

        // 2. Intercept Special Commands
        if (['ls', 'list', 'history'].includes(cmd)) {
            return handleHistory(parts.slice(1), transactions);
        }

        if (cmd === 'undo') {
            return await handleUndo(currentUser, transactions);
        }

        if (['stats', 'status', 'report'].includes(cmd)) {
            return handleStats(transactions);
        }

        // Quick Add from Templates
        if (['quick', 'q', 'template'].includes(cmd)) {
            return await handleQuick(parts.slice(1), templates, currentUser);
        }

        // 3. Standard Transaction Parsing
        const rawData = parseCommandString(commandString, userSettings || {});

        if (rawData.amount <= 0) throw new Error("Amount must be greater than 0");

        // Resolve Entities
        const participantGroups = userSettings?.participantGroups || [];
        const allGroups = [...(groups || []), ...participantGroups];

        const finalCategory = resolveCategory(rawData.category, categories);
        const finalGroupId = resolveGroup(rawData.group, groups);
        const finalPayer = resolvePayer(rawData.payer, participants);

        // Resolve Group Members
        let baseParticipants = [];
        if (rawData.group !== 'personal') {
            baseParticipants = resolveParticipants(rawData.group, allGroups, participants);
        }

        // Calculate Split Participants
        let splitIds = [...baseParticipants];
        if (rawData.includeMe) splitIds.push('me');
        splitIds = [...new Set(splitIds)];
        if (!rawData.includeMe) splitIds = splitIds.filter(id => id !== 'me');

        // Construct Transaction Data
        const txnData = {
            amount: Math.round(rawData.amount * 100),
            expenseName: rawData.expenseName,
            description: rawData.description || '',
            category: finalCategory,
            type: rawData.type,
            dateString: rawData.date.toISOString().split('T')[0],
            timestamp: Timestamp.fromDate(rawData.date),
            payer: finalPayer,
            splits: {},
            participants: baseParticipants,
            groupId: finalGroupId,
            tag: rawData.tag,
            place: rawData.place,
            modeOfPayment: rawData.mode,
            isDeleted: false,
            source: 'web-console',
            createdBy: currentUser.uid
        };

        // Interactive Split Trigger
        if (splitIds.length > 0 && (rawData.splitMethod === 'dynamic' || rawData.splitMethod === 'percentage')) {
            return {
                success: true,
                requiresInteraction: true,
                method: rawData.splitMethod,
                draftTxn: txnData,
                peopleToAsk: splitIds
            };
        }

        // Equal Split Logic
        if (splitIds.length > 0) {
            const share = Math.floor(txnData.amount / splitIds.length);
            splitIds.forEach(uid => txnData.splits[uid] = share);

            const remainder = txnData.amount - (share * splitIds.length);
            if (remainder > 0) {
                const recipient = splitIds.includes(finalPayer) ? finalPayer : splitIds[0];
                if (recipient) txnData.splits[recipient] = (txnData.splits[recipient] || 0) + remainder;
            }
            txnData.splitMethod = 'equal';
        } else {
            txnData.splits = { [finalPayer]: txnData.amount };
        }

        // Commit
        const id = await addTransaction(txnData);
        return {
            success: true,
            message: `Logged: ${txnData.expenseName} (${formatCurrency(txnData.amount)}) [${txnData.category}]${finalPayer !== 'me' ? ` [Paid by: ${finalPayer}]` : ''}`,
            data: { id }
        };

    } catch (error) {
        return { success: false, message: error.message };
    }
};
