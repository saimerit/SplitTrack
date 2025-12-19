// src/services/cliService.js
import useAppStore from '../store/useAppStore';
import { addTransaction } from './transactionService';
import { Timestamp } from 'firebase/firestore';
import { normalize } from '../utils/formatters';

// --- HELPERS ---
const resolveGroupOrParticipant = (identifier, participants, groups) => {
    const cleanId = identifier.replace('@', '');

    // 1. Try Group Match
    const foundGroup = groups.find(g => normalize(g.name) === normalize(cleanId));
    if (foundGroup) return foundGroup.members;

    // 2. Try Person Match
    const foundPerson = participants.find(p =>
        normalize(p.name) === normalize(cleanId) ||
        normalize(p.uniqueId) === normalize(cleanId)
    );
    return foundPerson ? [foundPerson.uniqueId] : [];
};

const resolveCategory = (input, categories) => {
    if (!input) return 'General';
    const match = categories.find(c => normalize(c.name) === normalize(input));
    return match ? match.name : input;
};

// --- MAIN EXECUTOR ---
export const executeCommand = async (commandString) => {
    // 1. DIRECT STORE ACCESS & SECURITY CHECK
    const state = useAppStore.getState();
    const { currentUser, categories, participants, userSettings, activeGroupId, groups } = state;

    // 🔒 SECURITY GATE: Stop immediately if not logged in
    if (!currentUser) {
        return { success: false, message: "⛔ Unauthorized: Please log in." };
    }

    const participantGroups = userSettings?.participantGroups || [];
    const parts = commandString.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    try {
        switch (cmd) {
            case 'exp':
            case 'add':
            case 'a': {
                // SYNTAX: exp <amount> <name> [category]
                if (args.length < 2) throw new Error('Usage: exp <amount> <name> [category]');
                const amount = parseFloat(args[0]);
                if (isNaN(amount)) throw new Error('Invalid amount');

                const name = args[1].replace(/_/g, ' ');
                const cat = resolveCategory(args[2], categories);

                const txnData = {
                    amount: Math.round(amount * 100),
                    expenseName: name,
                    category: cat,
                    type: 'expense',
                    dateString: new Date().toISOString().split('T')[0],
                    timestamp: Timestamp.now(),
                    payer: 'me',
                    splits: { 'me': Math.round(amount * 100) },
                    participants: [],
                    groupId: activeGroupId || 'personal',
                    tag: args[3] || '',
                    isDeleted: false,
                    source: 'web-console',
                    createdBy: currentUser.uid
                };

                const id = await addTransaction(txnData);
                return { success: true, message: `Processed: exp ${amount} ${name}`, data: { id } };
            }

            case 'split':
            case 's': {
                // SYNTAX: split <amount> <@who> <name>
                if (args.length < 3) throw new Error('Usage: split <amount> <@who> <name>');
                const sAmount = parseFloat(args[0]);
                const target = args[1];
                const sName = args[2].replace(/_/g, ' ');

                const allGroups = [...(groups || []), ...participantGroups];
                const involvedIds = resolveGroupOrParticipant(target, participants, allGroups);

                if (involvedIds.length === 0) throw new Error(`Target '${target}' not found.`);

                // Logic: I paid, split equally with them + me
                const totalPeople = involvedIds.length + 1;
                const totalPaise = Math.round(sAmount * 100);
                const share = Math.floor(totalPaise / totalPeople);

                const splits = { 'me': share };
                involvedIds.forEach(uid => splits[uid] = share);

                const remainder = totalPaise - (share * totalPeople);
                if (remainder > 0) splits['me'] += remainder;

                const splitTxn = {
                    amount: totalPaise,
                    expenseName: sName,
                    type: 'expense',
                    category: 'General',
                    dateString: new Date().toISOString().split('T')[0],
                    timestamp: Timestamp.now(),
                    payer: 'me',
                    splitMethod: 'equal',
                    splits: splits,
                    participants: involvedIds,
                    groupId: activeGroupId || 'personal',
                    isDeleted: false,
                    source: 'web-console',
                    createdBy: currentUser.uid
                };

                const sId = await addTransaction(splitTxn);
                return { success: true, message: `Processed: split ${sAmount} ${target} ${sName}`, data: { id: sId } };
            }

            case 'help':
                return { success: true, message: "Commands: exp <amt> <name>, split <amt> <who> <name>" };

            default:
                throw new Error(`Unknown command: ${cmd}`);
        }
    } catch (error) {
        return { success: false, message: error.message };
    }
};
