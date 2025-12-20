// src/services/cliService.js
import useAppStore from '../store/useAppStore';
import { addTransaction } from './transactionService';
import { Timestamp } from 'firebase/firestore';
import { normalize } from '../utils/formatters';
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

// NEW Helper: Resolve payer from input name
const resolvePayer = (inputName, participants) => {
    if (!inputName || inputName === 'me') return 'me';
    const clean = inputName.replace('@', '');
    const found = participants.find(p =>
        normalize(p.name) === normalize(clean) || normalize(p.uniqueId) === normalize(clean)
    );
    return found ? found.uniqueId : 'me';
};

// --- MAIN EXECUTOR ---
export const executeCommand = async (commandString, interactiveData = null) => {
    const state = useAppStore.getState();
    const { currentUser, categories, participants, userSettings, groups } = state;

    if (!currentUser) return { success: false, message: "⛔ Unauthorized: Please log in." };

    try {
        // --- CASE 1: RESUMING INTERACTIVE SESSION ---
        if (interactiveData) {
            const id = await addTransaction(interactiveData);
            return {
                success: true,
                message: `✅ Logged: ${interactiveData.expenseName} (₹${interactiveData.amount / 100})`,
                data: { id }
            };
        }

        // --- CASE 2: NORMAL PARSING ---
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

        // --- CALCULATE SPLIT PARTICIPANTS ---
        let splitIds = [...baseParticipants];

        // Add 'me' if includeMe is true
        if (rawData.includeMe) splitIds.push('me');

        // Ensure unique and remove 'me' if includeMe is false
        splitIds = [...new Set(splitIds)];
        if (!rawData.includeMe) splitIds = splitIds.filter(id => id !== 'me');

        // Construct Transaction Data
        const txnData = {
            amount: Math.round(rawData.amount * 100), // To Paise
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

        // --- INTERACTIVE SPLIT TRIGGER ---
        if (splitIds.length > 0 && (rawData.splitMethod === 'dynamic' || rawData.splitMethod === 'percentage')) {
            return {
                success: true,
                requiresInteraction: true,
                method: rawData.splitMethod,
                draftTxn: txnData,
                peopleToAsk: splitIds
            };
        }

        // --- EQUAL SPLIT LOGIC ---
        if (splitIds.length > 0) {
            const share = Math.floor(txnData.amount / splitIds.length);

            splitIds.forEach(uid => txnData.splits[uid] = share);

            // Give remainder to Payer or first person
            const remainder = txnData.amount - (share * splitIds.length);
            if (remainder > 0) {
                const recipient = splitIds.includes(finalPayer) ? finalPayer : splitIds[0];
                if (recipient) txnData.splits[recipient] = (txnData.splits[recipient] || 0) + remainder;
            }
            txnData.splitMethod = 'equal';
        } else {
            // Fallback: Expense assigned fully to Payer
            txnData.splits = { [finalPayer]: txnData.amount };
        }

        // Commit
        const id = await addTransaction(txnData);
        return {
            success: true,
            message: `✅ Logged: ${txnData.expenseName} (₹${rawData.amount}) [${txnData.category}]${finalPayer !== 'me' ? ` [Paid by: ${finalPayer}]` : ''}`,
            data: { id }
        };

    } catch (error) {
        return { success: false, message: error.message };
    }
};

