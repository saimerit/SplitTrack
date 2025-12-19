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
    // Input is already defaulted by parser, but we check if it matches a known category ID/Name
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

// --- MAIN EXECUTOR ---
export const executeCommand = async (commandString) => {
    const state = useAppStore.getState();
    const { currentUser, categories, participants, userSettings, groups } = state;

    if (!currentUser) return { success: false, message: "⛔ Unauthorized: Please log in." };

    try {
        // 1. PARSE with DEFAULTS from Store
        const rawData = parseCommandString(commandString, userSettings || {});

        if (rawData.amount <= 0) throw new Error("Amount must be greater than 0");

        // 2. Resolve IDs and Data
        const participantGroups = userSettings?.participantGroups || [];
        const allGroups = [...(groups || []), ...participantGroups];

        const finalCategory = resolveCategory(rawData.category, categories);
        const finalGroupId = resolveGroup(rawData.group, groups);

        // Resolve Participants (for splits)
        let finalParticipants = [];
        if (rawData.group !== 'personal') {
            finalParticipants = resolveParticipants(rawData.group, allGroups, participants);
        }

        // 3. Construct Transaction
        const txnData = {
            amount: Math.round(rawData.amount * 100), // To Paise
            expenseName: rawData.expenseName,
            description: rawData.description || '',
            category: finalCategory,
            type: rawData.type,
            dateString: rawData.date.toISOString().split('T')[0],
            timestamp: Timestamp.fromDate(rawData.date),

            payer: rawData.payer,
            splits: { 'me': Math.round(rawData.amount * 100) },

            participants: finalParticipants,
            groupId: finalGroupId,

            // New Fields from Defaults
            tag: rawData.tag,
            place: rawData.place,
            modeOfPayment: rawData.mode,

            isDeleted: false,
            source: 'web-console',
            createdBy: currentUser.uid
        };

        // 4. Handle Splits Logic
        if (finalParticipants.length > 0 && rawData.splitMethod === 'equal') {
            const totalPeople = finalParticipants.length + 1;
            const share = Math.floor(txnData.amount / totalPeople);
            txnData.splits = { 'me': share };
            finalParticipants.forEach(uid => txnData.splits[uid] = share);

            const remainder = txnData.amount - (share * totalPeople);
            if (remainder > 0) txnData.splits['me'] += remainder;

            txnData.splitMethod = 'equal';
        }

        // 5. Commit
        const id = await addTransaction(txnData);
        return {
            success: true,
            message: `Logged: ${txnData.expenseName} (₹${rawData.amount}) [${txnData.category}]`,
            data: { id }
        };

    } catch (error) {
        return { success: false, message: error.message };
    }
};
