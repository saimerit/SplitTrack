import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Fuse from 'fuse.js';
import { Timestamp, addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { addTransaction, updateTransaction } from '../services/transactionService';
import { validateSplits } from '../utils/validators';
import { applySmartRules } from '../utils/applySmartRules';
import useAppStore from '../store/useAppStore';

const getTxnTime = (txn) => {
    if (!txn?.timestamp) return 0;
    return txn.timestamp.toMillis ? txn.timestamp.toMillis() : new Date(txn.timestamp).getTime();
};

const getTxnDateStr = (txn) => {
    if (!txn?.timestamp) return '';
    const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

// Helper for Smart Name generation
const generateSmartNameHelper = (links, subTypeStr) => {
    if (!links || links.length === 0) return "";
    let prefix = "Refund";
    if (subTypeStr === 'settlement') prefix = "Settlement";
    else if (subTypeStr === 'forgiveness') prefix = "Forgiven";
    return `${prefix}: ` + links.map(t => t.name).join(', ');
};

export const useTransactionFormLogic = (initialData, isEditMode) => {
    const navigate = useNavigate();
    const {
        categories, places, tags, modesOfPayment,
        rawParticipants, rawTransactions, groups,
        userSettings, showToast, activeGroupId, smartRules
    } = useAppStore();

    const wasMeIncluded = initialData?.splits ? (initialData.splits['me'] !== undefined) : true;

    // --- STATE ---
    const [formGroupId, setFormGroupId] = useState(initialData?.groupId || activeGroupId || 'personal');
    const [type, setType] = useState(() => {
        if (initialData?.isReturn) return 'refund';
        if (initialData && initialData.amount < 0) return 'refund';
        return initialData?.type || 'expense';
    });

    const [refundSubType, setRefundSubType] = useState(() => initialData?.isReturn ? 'settlement' : 'product');
    const [name, setName] = useState(initialData?.expenseName || '');
    const [amount, setAmount] = useState(initialData ? (Math.abs(initialData.amount) / 100).toFixed(2) : '');

    const [date, setDate] = useState(() => {
        try {
            if (initialData?.timestamp) {
                let d;
                if (typeof initialData.timestamp.toDate === 'function') d = initialData.timestamp.toDate();
                else if (initialData.timestamp.seconds) d = new Date(initialData.timestamp.seconds * 1000);
                else d = new Date(initialData.timestamp);
                if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
            }
        } catch (e) { console.warn("Date parsing error:", e); }
        return new Date().toISOString().split('T')[0];
    });

    const [category, setCategory] = useState(initialData?.category || userSettings.defaultCategory || '');
    const [place, setPlace] = useState(initialData?.place || userSettings.defaultPlace || '');
    const [tag, setTag] = useState(initialData?.tag || userSettings.defaultTag || '');
    const [mode, setMode] = useState(initialData?.modeOfPayment || userSettings.defaultMode || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [payer, setPayer] = useState(initialData?.payer || 'me');
    const [selectedParticipants, setSelectedParticipants] = useState(initialData?.participants || []);

    const [linkedTxns, setLinkedTxns] = useState([]);
    const [tempSelectId, setTempSelectId] = useState('');
    const [repaymentFilter, setRepaymentFilter] = useState('');
    const [splitMethod, setSplitMethod] = useState(initialData?.splitMethod || 'equal');
    const [splits, setSplits] = useState(initialData?.splits || {});
    const [includeMe, setIncludeMe] = useState(wasMeIncluded);
    const [includePayer, setIncludePayer] = useState(false);

    // --- MULTI-MODE PAYMENT STATE ---
    const [isMultiMode, setIsMultiMode] = useState(() => {
        return initialData?.modeOfPayment === 'Multi' || (initialData?.paymentBreakdown?.length > 1);
    });
    const [paymentBreakdown, setPaymentBreakdown] = useState(() => {
        if (initialData?.paymentBreakdown?.length > 0) {
            return initialData.paymentBreakdown.map(p => ({
                mode: p.mode || '',
                amount: (p.amount / 100).toFixed(2) // Convert paise to rupees for display
            }));
        }
        return [];
    });

    // UI Triggers
    const [showDupeModal, setShowDupeModal] = useState(false);
    const [dupeTxn, setDupeTxn] = useState(null);
    const [activePrompt, setActivePrompt] = useState(null);
    const [suggestion, setSuggestion] = useState(null);
    const [showSuccess, setShowSuccess] = useState(false);
    const hasInitializedLinks = useRef(false);

    // --- COMPUTED ---
    const allParticipants = useMemo(() => [...rawParticipants], [rawParticipants]);
    const groupTransactions = useMemo(() => {
        return rawTransactions.filter(t => (t.groupId || 'personal') === formGroupId && !t.isDeleted);
    }, [rawTransactions, formGroupId]);

    const participantsLookup = useMemo(() => {
        const map = new Map();
        map.set('me', { name: 'You (me)', uniqueId: 'me' });
        allParticipants.forEach(p => map.set(p.uniqueId, p));
        return map;
    }, [allParticipants]);

    const isRefundTab = type === 'refund';
    const isSettlement = isRefundTab && refundSubType === 'settlement';
    const isForgiveness = isRefundTab && refundSubType === 'forgiveness';
    const isProductRefund = isRefundTab && refundSubType === 'product';
    const isIncome = type === 'income';

    const getName = useCallback((uid) => {
        if (uid === 'me') return 'You';
        return participantsLookup.get(uid)?.name || uid;
    }, [participantsLookup]);

    // --- INTERNAL HELPERS ---

    const updateSmartName = (links, subTypeStr) => {
        const smartName = generateSmartNameHelper(links, subTypeStr);
        if (!smartName) return;
        if (!name || name.startsWith("Refund:") || name.startsWith("Settlement:") || name.startsWith("Repayment:")) {
            setName(smartName);
        }
    };

    const getOutstandingDebt = useCallback((parentTxn, debtorId) => {
        let debt = parentTxn.splits?.[debtorId] || 0;
        const originalDebt = debt;

        // Use a Set to prevent double-counting the same related transaction
        const processedIds = new Set();

        const related = groupTransactions.filter(t => {
            if (isEditMode && t.id === initialData?.id) return false;
            // Check if this transaction is linked to the parent
            const isLinkedViaParentId = t.parentTransactionId === parentTxn.id;
            const isLinkedViaParentIds = t.parentTransactionIds && t.parentTransactionIds.includes(parentTxn.id);
            return isLinkedViaParentId || isLinkedViaParentIds;
        });

        related.forEach(rel => {
            // Skip if already processed (prevents double-counting)
            if (processedIds.has(rel.id)) return;
            processedIds.add(rel.id);

            if (rel.isReturn) {
                // For settlements (isReturn=true), we need to check if this settlement was FOR the specific debtor
                // A settlement reduces debt when:
                // 1. The debtor is the payer of the settlement (they paid back), OR
                // 2. The debtor is the recipient of the settlement (in participants array) - means 'me' paid them back
                const link = rel.linkedTransactions?.find(l => l.id === parentTxn.id);
                const debtorIsPayer = rel.payer === debtorId;
                const debtorIsRecipient = rel.participants?.includes(debtorId);

                if (link) {
                    // Only subtract if this settlement is for the specific debtor
                    if (debtorIsPayer || debtorIsRecipient) {
                        console.log(`[DEBT] Parent: ${parentTxn.expenseName.slice(0, 20)}, Settlement: ${rel.expenseName?.slice(0, 20)}, link.amount=${link.amount}, subtracting ${Math.abs(link.amount)}`);
                        // If parent is a settlement (credit), we ADD to reduce the credit (move closer to 0)
                        if (parentTxn.isReturn) {
                            debt += Math.abs(link.amount);
                        } else {
                            debt -= Math.abs(link.amount);
                        }
                    }
                } else if (debtorIsPayer && (!rel.linkedTransactions || rel.linkedTransactions.length === 0)) {
                    // Unlinked settlement where debtor is the payer
                    console.log(`[DEBT] Parent: ${parentTxn.expenseName.slice(0, 20)}, Unlinked settlement, subtracting ${Math.abs(rel.amount)}`);
                    debt -= Math.abs(rel.amount);
                }
            } else if (rel.amount < 0) {
                // Product refund - reduce the debtor's share if they had a split
                let refundShare = rel.splits?.[debtorId] || 0;
                debt += refundShare;
            }
        });

        if (originalDebt !== debt && parentTxn.payer !== 'me') {
            console.log(`[DEBT] FINAL: ${parentTxn.expenseName.slice(0, 30)} | original=${originalDebt} | remaining=${debt}`);
        }

        return debt;
    }, [groupTransactions, isEditMode, initialData]);

    // Calculate net debt between 'me' and another person
    // Returns positive if I owe them, negative if they owe me
    const getNetDebtWithPerson = useCallback((personId) => {
        if (!personId || personId === 'me') return 0;

        let iOweThem = 0;  // Debts I owe to this person
        let theyOweMe = 0; // Debts this person owes to me

        groupTransactions.forEach(t => {
            if (t.isReturn || t.isDeleted) return;

            // Transactions where this person paid and I have a split (I owe them)
            if (t.payer === personId && t.splits?.['me'] > 0) {
                iOweThem += getOutstandingDebt(t, 'me');
            }

            // Transactions where I paid and they have a split (they owe me)
            if (t.payer === 'me' && t.splits?.[personId] > 0) {
                theyOweMe += getOutstandingDebt(t, personId);
            }
        });

        return iOweThem - theyOweMe; // Positive = I owe them, Negative = they owe me
    }, [groupTransactions, getOutstandingDebt]);

    const eligibleParents = useMemo(() => {
        // For settlements and forgiveness, show debt-based transactions
        if (!isSettlement && !isForgiveness) {
            return groupTransactions
                .filter(t => t.amount > 0 && !t.isReturn)
                .filter(t => !linkedTxns.some(l => l.id === t.id))
                .map(t => ({ ...t, remainingRefundable: (t.netAmount !== undefined ? t.netAmount : t.amount) }))
                .filter(t => t.remainingRefundable > 0)
                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
        }

        const debtsIOwe = groupTransactions.filter(t => !t.isReturn && t.payer !== 'me' && t.splits?.['me'] > 0)
            .map(t => ({ ...t, relationType: 'owed_by_me', counterParty: t.payer, outstanding: getOutstandingDebt(t, 'me') }));

        // Find transactions where others owe me (I paid, splits show who owes what)
        const debtsTheyOwe = groupTransactions.filter(t => {
            if (t.isReturn || t.payer !== 'me') return false;
            // Check if splits has positive values for non-me participants
            const hasSplitDebts = Object.keys(t.splits || {}).some(uid => uid !== 'me' && t.splits[uid] > 0);
            // Fallback: check participants array if splits are empty (handles older transactions or data issues)
            const hasParticipantDebts = !hasSplitDebts && Array.isArray(t.participants) && t.participants.length > 0 && t.amount > 0;
            return hasSplitDebts || hasParticipantDebts;
        }).flatMap(t => {
            // First try to use splits
            const splitEntries = Object.keys(t.splits || {}).filter(uid => uid !== 'me' && t.splits[uid] > 0);
            if (splitEntries.length > 0) {
                return splitEntries.map(uid => {
                    const outstanding = getOutstandingDebt(t, uid);
                    return { ...t, relationType: 'owed_to_me', counterParty: uid, outstanding };
                });
            }
            // Fallback: use participants with equal split assumption
            return (t.participants || []).filter(uid => uid !== 'me').map(uid => {
                const participantCount = (t.participants || []).filter(uid => uid !== 'me').length;
                const equalShare = participantCount > 0 ? Math.round(t.amount / participantCount) : t.amount;
                return { ...t, relationType: 'owed_to_me', counterParty: uid, outstanding: equalShare };
            });
        });

        // Find settlements that can be continued (have POSITIVE remaining debt)
        // These are settlements (isReturn=true) where linked parent EXPENSES have outstanding debt
        // Skip parents that are themselves settlements - only count original expense debt
        const partialSettlements = groupTransactions.filter(t => {
            if (!t.isReturn) return false;


            // Get ALL linked parent IDs
            let allParentIds = [];
            if (t.parentTransactionId) allParentIds.push(t.parentTransactionId);
            if (t.parentTransactionIds && t.parentTransactionIds.length > 0) {
                allParentIds = [...new Set([...allParentIds, ...t.parentTransactionIds])];
            }
            // Also check linkedTransactions for parent IDs
            if (t.linkedTransactions && t.linkedTransactions.length > 0) {
                const linkedIds = t.linkedTransactions.map(l => l.id);
                allParentIds = [...new Set([...allParentIds, ...linkedIds])];
            }
            if (allParentIds.length === 0) return false;

            // Get the counterparty from the settlement
            const counterParty = t.payer === 'me' ? (t.participants && t.participants[0]) : t.payer;
            if (!counterParty || counterParty === 'me') return false;

            // Calculate TOTAL remaining (original debt - amount paid)
            let totalRemaining = 0;
            let expenseParentCount = 0;
            for (const parentId of allParentIds) {
                const parentTxn = groupTransactions.find(p => p.id === parentId && !p.isDeleted);
                // Skip if parent is also a settlement - only count original expenses
                if (parentTxn && !parentTxn.isReturn) {
                    expenseParentCount++;
                    const debtorId = parentTxn.payer === 'me' ? counterParty : 'me';
                    totalRemaining += getOutstandingDebt(parentTxn, debtorId);
                }
            }

            // CHECK FOR CONSUMED CREDIT:
            // If this settlement is overpaid (negative totalRemaining), check if any NEW transactions
            // have linked TO this settlement as a parent to use that credit.
            if (totalRemaining < 0) {
                const childUsage = groupTransactions
                    .filter(child =>
                        !child.isDeleted &&
                        (child.parentTransactionId === t.id || (child.parentTransactionIds && child.parentTransactionIds.includes(t.id)))
                    )
                    .reduce((sum, child) => {
                        // If child is an expense, it ADDS to the debt (consumes credit)
                        // If child is a settlement, it might be an adjustment
                        return sum + (child.amount || 0);
                    }, 0);

                // Add the child usage to the negative remaining (reducing the credit)
                // e.g. remaining -200 (credit), used 50 -> result -150
                // If usage is 200, result is 0 (fully used)
                totalRemaining += childUsage;
            }

            // Only include if there's significant remaining debt or credit
            return Math.abs(totalRemaining) > 1;
        }).map(t => {
            // Get ALL linked parent IDs again
            let allParentIds = [];
            if (t.parentTransactionId) allParentIds.push(t.parentTransactionId);
            if (t.parentTransactionIds && t.parentTransactionIds.length > 0) {
                allParentIds = [...new Set([...allParentIds, ...t.parentTransactionIds])];
            }
            if (t.linkedTransactions && t.linkedTransactions.length > 0) {
                const linkedIds = t.linkedTransactions.map(l => l.id);
                allParentIds = [...new Set([...allParentIds, ...linkedIds])];
            }

            const counterParty = t.payer === 'me' ? (t.participants && t.participants[0]) : t.payer;

            // Calculate TOTAL remaining (only from expenses, skip settlement parents)
            let totalRemaining = 0;
            let firstParent = null;
            for (const parentId of allParentIds) {
                const parentTxn = groupTransactions.find(p => p.id === parentId && !p.isDeleted);
                // Skip if parent is also a settlement - only count original expenses
                if (parentTxn && !parentTxn.isReturn) {
                    if (!firstParent) firstParent = parentTxn;
                    const debtorId = parentTxn.payer === 'me' ? counterParty : 'me';
                    totalRemaining += getOutstandingDebt(parentTxn, debtorId);
                }
            }

            // CHECK FOR CONSUMED CREDIT (Same lookup as filter)
            if (totalRemaining < 0) {
                const childUsage = groupTransactions
                    .filter(child =>
                        !child.isDeleted &&
                        (child.parentTransactionId === t.id || (child.parentTransactionIds && child.parentTransactionIds.includes(t.id)))
                    )
                    .reduce((sum, child) => sum + (child.amount || 0), 0);
                totalRemaining += childUsage;
            }

            const relationType = firstParent?.payer === 'me' ? 'owed_to_me' : 'owed_by_me';

            // Return the SETTLEMENT transaction with its own ID, but with total remaining debt
            return {
                id: t.id,
                expenseName: t.expenseName,
                timestamp: t.timestamp,
                amount: t.amount,
                payer: t.payer,
                participants: t.participants,
                linkedTransactions: t.linkedTransactions,
                parentTransactionId: allParentIds[0],
                parentTransactionIds: allParentIds,
                isPartialSettlement: true,
                isReturn: true,
                parentExpenseName: firstParent?.expenseName || t.expenseName,
                relationType,
                counterParty,
                outstanding: totalRemaining,
                // Show remaining amount
                displayName: totalRemaining < 0
                    ? `⚠️ Overpaid: ${t.expenseName} (₹${(Math.abs(totalRemaining) / 100).toFixed(2)} credit)`
                    : `🔄 Continue: ${t.expenseName} (₹${(totalRemaining / 100).toFixed(2)} remaining)`
            };
        });

        // Collect all parent transaction IDs that are already covered by partial settlements
        // These should be excluded from parentDebts to avoid showing duplicates
        const parentIdsWithPartialSettlements = new Set();
        partialSettlements.forEach(ps => {
            if (ps.parentTransactionIds) {
                ps.parentTransactionIds.forEach(pid => parentIdsWithPartialSettlements.add(pid));
            }
        });

        // Combine all sources - partial settlements are added separately
        // Filter out transactions that already have partial settlements (user should continue those instead)
        const parentDebts = [...debtsIOwe, ...debtsTheyOwe]
            .filter(t => t.outstanding > 1)
            .filter(t => !parentIdsWithPartialSettlements.has(t.id));
        let all = [...parentDebts, ...partialSettlements];

        // Filter by debtor - works the same for both settlement and forgiveness
        if (repaymentFilter) {
            all = all.filter(t => t.counterParty === repaymentFilter);
        }
        else {
            const targetPerson = payer === 'me' ? selectedParticipants[0] : payer;
            if (targetPerson && targetPerson !== 'me') all = all.filter(t => t.counterParty === targetPerson);
        }

        // We use Math.abs > 1 to avoid showing transactions settled within 1 paise/cent
        const result = all.filter(t => Math.abs(t.outstanding) > 1).filter(t => !linkedTxns.some(l => l.id === t.id)).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        return [...new Map(result.map(item => [`${item.id}-${item.counterParty}`, item])).values()];
    }, [groupTransactions, linkedTxns, isSettlement, isForgiveness, payer, selectedParticipants, repaymentFilter, getOutstandingDebt]);

    // --- EFFECTS ---

    useEffect(() => {
        if (hasInitializedLinks.current || groupTransactions.length === 0) return;
        if (initialData && initialData.linkedTransactions) {
            const linksToSet = initialData.linkedTransactions.map(link => {
                const original = groupTransactions.find(t => t.id === link.id) || rawTransactions.find(t => t.id === link.id);
                const full = original ? Math.abs(original.amount) : 0;
                let allocVal = link.amount;
                if (initialData.amount < 0 && !initialData.isReturn) allocVal = Math.abs(allocVal);

                return {
                    id: link.id,
                    name: original ? original.expenseName : 'Unknown',
                    dateStr: getTxnDateStr(original),
                    timestamp: getTxnTime(original),
                    fullAmount: full,
                    maxAllocatable: full,
                    allocated: (allocVal / 100).toFixed(2),
                    relationType: (original && original.payer !== 'me' && original.splits?.['me']) ? 'owed_by_me' : 'owed_to_me'
                };
            });
            setTimeout(() => {
                setLinkedTxns(linksToSet);
                const currentSubType = initialData?.isReturn ? 'settlement' : 'product';
                const smartName = generateSmartNameHelper(linksToSet, currentSubType);
                if (!initialData?.expenseName) setName(smartName);
                hasInitializedLinks.current = true;
            }, 0);
        }
    }, [initialData, groupTransactions, rawTransactions]);

    useEffect(() => {
        if (isEditMode || !name || name.length < 3) {
            if (suggestion !== null) Promise.resolve().then(() => setSuggestion(null));
            return;
        }
        const timer = setTimeout(() => {
            const fuse = new Fuse(groupTransactions.slice(0, 500), { keys: ['expenseName'], threshold: 0.3 });
            const result = fuse.search(name);
            if (result.length > 0) {
                const bestMatch = result[0].item;
                if ((!category && bestMatch.category) || (!place && bestMatch.place) || (!tag && bestMatch.tag)) {
                    setSuggestion(bestMatch);
                } else {
                    Promise.resolve().then(() => setSuggestion(null));
                }
            } else {
                Promise.resolve().then(() => setSuggestion(null));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [name, isEditMode, groupTransactions, category, place, tag, suggestion]);

    // --- EFFECT: Apply defaults when userSettings loads (for new transactions only) ---
    useEffect(() => {
        if (isEditMode || !userSettings) return;

        // Only update if the current values are still empty (not yet set by user)
        if (!category && userSettings.defaultCategory) setCategory(userSettings.defaultCategory);
        if (!place && userSettings.defaultPlace) setPlace(userSettings.defaultPlace);
        if (!tag && userSettings.defaultTag) setTag(userSettings.defaultTag);
        if (!mode && userSettings.defaultMode) setMode(userSettings.defaultMode);
    }, [userSettings, isEditMode, category, place, tag, mode]);

    // --- ACTIONS ---

    // FEATURE: Reset Form
    const resetForm = useCallback(() => {
        const source = isEditMode ? initialData : {};
        const defaults = userSettings || {};

        setFormGroupId(source.groupId || activeGroupId || 'personal');

        let newType = 'expense';
        if (source.isReturn) newType = 'refund';
        else if (source.amount < 0) newType = 'refund';
        else if (source.type) newType = source.type;
        setType(newType);

        setRefundSubType(source.isReturn ? 'settlement' : 'product');
        setName(source.expenseName || '');
        setAmount(source.amount ? (Math.abs(source.amount) / 100).toFixed(2) : '');

        let newDate = new Date().toISOString().split('T')[0];
        try {
            if (source.timestamp) {
                let d;
                if (typeof source.timestamp.toDate === 'function') d = source.timestamp.toDate();
                else if (source.timestamp.seconds) d = new Date(source.timestamp.seconds * 1000);
                else d = new Date(source.timestamp);
                if (!isNaN(d.getTime())) newDate = d.toISOString().split('T')[0];
            }
        } catch {
            // Ignore
        }
        setDate(newDate);

        setCategory(source.category || defaults.defaultCategory || '');
        setPlace(source.place || defaults.defaultPlace || '');
        setTag(source.tag || defaults.defaultTag || '');
        setMode(source.modeOfPayment || defaults.defaultMode || '');
        setDescription(source.description || '');
        setPayer(source.payer || 'me');
        setSelectedParticipants(source.participants || []);

        setLinkedTxns([]);
        if (isEditMode) hasInitializedLinks.current = false;

        setTempSelectId('');
        setRepaymentFilter('');
        setSplitMethod(source.splitMethod || 'equal');
        setSplits(source.splits || {});
        setIncludeMe(source.splits ? (source.splits['me'] !== undefined) : true);
        setIncludePayer(false);

        setShowDupeModal(false);
        setDupeTxn(null);
        setSuggestion(null);

        // Reset Multi-Mode state
        setIsMultiMode(false);
        setPaymentBreakdown([]);

        showToast("Form reset!", false);
    }, [initialData, isEditMode, activeGroupId, userSettings, showToast]);

    // FEATURE: Handle Type Change (Clears relevant fields)
    const handleTypeChange = (newType) => {
        setType(newType);

        // Clear fields irrelevant to new type
        setName('');
        setAmount('');
        setDescription('');
        setSplits({});
        setLinkedTxns([]);
        setSelectedParticipants([]);

        // Reset Meta fields to defaults
        setCategory(userSettings.defaultCategory || '');
        setPlace(userSettings.defaultPlace || '');
        setTag(userSettings.defaultTag || '');
        setMode(userSettings.defaultMode || '');

        if (newType === 'income') {
            setPayer('me');
        }
    };

    // FEATURE: Handle Refund SubType Change (Product vs Settlement)
    const handleRefundSubTypeChange = (newSub) => {
        setRefundSubType(newSub);

        // Clear data that might conflict
        setName('');
        setAmount('');
        setLinkedTxns([]);
        setSelectedParticipants([]);
        setSplits({});
    };

    const handlePayerChange = (newPayer) => {
        setPayer(newPayer);
        if (isSettlement && selectedParticipants[0] === newPayer) setSelectedParticipants([]);
        if (newPayer === 'me') setIncludePayer(false);
        else if (isEditMode && initialData?.payer === newPayer && initialData.splits && initialData.splits[newPayer]) setIncludePayer(true);
    };

    const handleRecipientChange = (newRecipient) => {
        if (!newRecipient || (isSettlement && newRecipient === payer)) {
            setSelectedParticipants([]);
            return;
        }
        setSelectedParticipants([newRecipient]);
    };

    const handleFlipDirection = (newPositiveAmount, currentLinks, counterParty = null) => {
        const oldPayer = payer;
        // Use the provided counterParty if selectedParticipants is empty
        const oldRecipient = selectedParticipants[0] || counterParty;
        if (!oldRecipient || oldRecipient === oldPayer) return;
        setPayer(oldRecipient);
        setSelectedParticipants([oldPayer]);
        const invertedLinks = currentLinks.map(l => ({ ...l, allocated: (parseFloat(l.allocated) * -1).toFixed(2) }));
        setLinkedTxns(invertedLinks);
        setAmount(newPositiveAmount.toFixed(2));
    };

    const handleLinkSelect = (parentId) => {
        if (!parentId) return;
        const parent = eligibleParents.find(p => p.id === parentId);
        if (!parent) return;

        let allocValue = 0;
        let newLink = null;

        // Product refund logic - uses full transaction amount
        if (!isSettlement && !isForgiveness) {
            allocValue = (parent.remainingRefundable || parent.amount) / 100;
            setAmount(allocValue.toFixed(2));
            if (parent.payer) setPayer(parent.payer);

            const parentSplits = parent.splits || {};
            const involvedIDs = Object.keys(parentSplits);
            setSelectedParticipants(involvedIDs.filter(id => id !== 'me'));

            if (parent.splitMethod === 'equal') {
                setSplitMethod('equal');
                setSplits({});
            } else {
                const totalParent = Math.abs(parent.amount);
                const newSplits = {};
                involvedIDs.forEach(id => { newSplits[id] = (parentSplits[id] / totalParent) * 100; });
                setSplitMethod('percentage');
                setSplits(newSplits);
            }
            setIncludeMe(involvedIDs.includes('me'));
            if (parent.payer !== 'me') setIncludePayer(involvedIDs.includes(parent.payer));

            newLink = {
                id: parent.id,
                name: parent.expenseName,
                dateStr: getTxnDateStr(parent),
                timestamp: getTxnTime(parent),
                fullAmount: Math.abs(parent.amount),
                maxAllocatable: parent.remainingRefundable || parent.amount,
                allocated: allocValue.toFixed(2),
                relationType: 'product_refund'
            };
            setLinkedTxns([newLink]);
            updateSmartName([newLink], refundSubType);
        } else {
            // Settlement and Forgiveness logic - uses debtor's outstanding share
            if (payer === 'me' && selectedParticipants.length === 0) {
                const inferred = parent.counterParty;
                if (inferred && inferred !== 'me') setSelectedParticipants([inferred]);
            }
            const outstandingRupees = parent.outstanding / 100;
            const isMyDebt = parent.relationType === 'owed_by_me';

            // Settlement: owed_by_me = positive (I pay off my debt), owed_to_me = negative (flip, they pay me)
            // Forgiveness: owed_to_me = positive (I forgive, I'm the giver), owed_by_me = negative (flip, they forgive me)
            if (isForgiveness) {
                // Inverted signs for forgiveness
                allocValue = (payer === 'me') ? (isMyDebt ? -outstandingRupees : outstandingRupees) : (isMyDebt ? outstandingRupees : -outstandingRupees);
            } else {
                // Settlement logic
                allocValue = (payer === 'me') ? (isMyDebt ? outstandingRupees : -outstandingRupees) : (isMyDebt ? -outstandingRupees : outstandingRupees);
            }

            const currentTotal = parseFloat(amount) || 0;
            let newTotal = currentTotal + allocValue;
            let shouldFlip = false;

            // Flip direction if total goes negative (works for both settlement and forgiveness)
            if (newTotal < 0) { shouldFlip = true; newTotal = Math.abs(newTotal); }

            newLink = {
                id: parent.id,
                name: parent.expenseName,
                dateStr: getTxnDateStr(parent),
                timestamp: getTxnTime(parent),
                fullAmount: Math.abs(parent.amount),
                maxAllocatable: parent.outstanding,
                allocated: allocValue.toFixed(2),
                relationType: parent.relationType
            };

            // FIX: Append new link instead of replacing
            const updatedLinks = [...linkedTxns, newLink];
            if (shouldFlip) handleFlipDirection(newTotal, updatedLinks, parent.counterParty);
            else { setLinkedTxns(updatedLinks); setAmount(newTotal.toFixed(2)); }
            updateSmartName(updatedLinks, refundSubType);
        }
        setTempSelectId('');
    };

    const autoUpdateTotal = (currentLinks) => {
        const total = currentLinks.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0);
        if (total < 0) {
            handleFlipDirection(Math.abs(total), currentLinks);
        } else {
            setAmount(total.toFixed(2));
        }
    };

    const removeLinkedTxn = (id) => {
        const updatedLinks = linkedTxns.filter(t => t.id !== id);
        setLinkedTxns(updatedLinks);
        if (isSettlement) autoUpdateTotal(updatedLinks);
        updateSmartName(updatedLinks, refundSubType);
    };

    const updateLinkedAllocation = (id, val) => {
        const updatedLinks = linkedTxns.map(t => t.id === id ? { ...t, allocated: val } : t);
        setLinkedTxns(updatedLinks);
        if (isSettlement) autoUpdateTotal(updatedLinks);
    };

    const handleAmountChange = (e) => {
        const val = e.target.value;
        setAmount(val);

        // FIX: Sync allocation for ANY single link (Refund OR Settlement)
        if (linkedTxns.length === 1) {
            setLinkedTxns(prev => prev.map(t => ({ ...t, allocated: val })));
        }
    };

    const handleQuickAddRequest = (value, col, label) => {
        if (value === `add_new_${col}`) {
            setActivePrompt({ type: 'quickAdd', targetCollection: col, targetLabel: label, title: `Add New ${label}`, label: `New ${label} Name` });
        } else {
            if (col === 'categories') setCategory(value);
            if (col === 'places') setPlace(value);
            if (col === 'tags') setTag(value);
            if (col === 'modesOfPayment') setMode(value);
        }
    };

    const handlePromptConfirm = async (inputValue) => {
        if (!inputValue) return;
        const { type: promptType, targetCollection, targetLabel } = activePrompt || {};

        if (promptType === 'quickAdd') {
            try {
                await addDoc(collection(db, `ledgers/main-ledger/${targetCollection}`), { name: inputValue });
                showToast(`${targetLabel} added!`);
                if (targetCollection === 'categories') setCategory(inputValue);
                if (targetCollection === 'places') setPlace(inputValue);
                if (targetCollection === 'tags') setTag(inputValue);
                if (targetCollection === 'modesOfPayment') setMode(inputValue);
            } catch (e) { console.error(e); showToast("Failed to add item.", true); }
        } else if (promptType === 'template') {
            // Template save logic
            const amountInRupees = parseFloat(amount);
            const multiplier = isProductRefund ? -1 : 1;
            const finalAmount = !isNaN(amountInRupees) ? Math.round(amountInRupees * 100) * multiplier : null;

            const templateData = {
                name: inputValue, expenseName: name, amount: finalAmount,
                type: isSettlement ? 'expense' : type, category, place, tag, modeOfPayment: mode, description,
                payer: isIncome ? 'me' : payer, isReturn: isSettlement,
                participants: isIncome ? [] : (isSettlement ? [selectedParticipants[0]] : selectedParticipants),
                splitMethod: (isSettlement || isIncome) ? 'none' : splitMethod, splits: (isSettlement || isIncome) ? {} : splits,
                groupId: formGroupId
            };
            try {
                await addDoc(collection(db, 'ledgers/main-ledger/templates'), templateData);
                showToast("Template saved successfully!");
            } catch (error) {
                console.error(error); showToast("Failed to save template.", true);
            }
        }
        setActivePrompt(null);
    };

    const applySuggestion = () => {
        if (!suggestion) return;
        if (suggestion.category && !category) setCategory(suggestion.category);
        if (suggestion.place && !place) setPlace(suggestion.place);
        if (suggestion.tag && !tag) setTag(suggestion.tag);
        setSuggestion(null);
        showToast("Autofilled details!");
    };

    const handleTemplateSaveRequest = () => {
        setActivePrompt({ type: 'template', title: 'Save as Template', label: 'Template Name' });
    };

    const handleParticipantAdd = (uid) => setSelectedParticipants([...selectedParticipants, uid]);
    const handleParticipantRemove = (uid) => setSelectedParticipants(selectedParticipants.filter(x => x !== uid));

    // --- FEATURE: Add Group of Participants ---
    const handleGroupAdd = (groupIds) => {
        const unique = new Set(selectedParticipants);
        let addedCount = 0;

        groupIds.forEach(id => {
            // Ensure ID exists in current context and isn't 'me'
            if (id !== 'me' && participantsLookup.has(id)) {
                if (!unique.has(id)) {
                    unique.add(id);
                    addedCount++;
                }
            }
        });

        if (addedCount > 0) {
            setSelectedParticipants(Array.from(unique));
            showToast(`Added ${addedCount} participants from group.`);
        } else {
            showToast("All group members are already selected or invalid.", true);
        }
    };

    // --- MULTI-MODE PAYMENT HELPERS ---
    const addPaymentMode = () => {
        setPaymentBreakdown([...paymentBreakdown, { mode: '', amount: '' }]);
    };

    const removePaymentMode = (index) => {
        setPaymentBreakdown(paymentBreakdown.filter((_, i) => i !== index));
    };

    const updatePaymentMode = (index, field, value) => {
        setPaymentBreakdown(paymentBreakdown.map((item, i) =>
            i === index ? { ...item, [field]: value } : item
        ));
    };

    // Calculate remaining amount for Multi-Mode
    const getMultiModeRemaining = () => {
        const total = parseFloat(amount) || 0;
        const allocated = paymentBreakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        return (total - allocated).toFixed(2);
    };

    // Auto-fill remaining amount for last mode
    const autoFillLastMode = () => {
        if (paymentBreakdown.length === 0) return;
        const remaining = parseFloat(getMultiModeRemaining());
        if (remaining > 0) {
            const lastIndex = paymentBreakdown.length - 1;
            const currentAmount = parseFloat(paymentBreakdown[lastIndex].amount) || 0;
            updatePaymentMode(lastIndex, 'amount', (currentAmount + remaining).toFixed(2));
        }
    };

    const splitAllocatorParticipants = useMemo(() => [
        ...(includeMe ? [{ uniqueId: 'me', name: 'You' }] : []),
        ...(payer !== 'me' && !selectedParticipants.includes(payer) && includePayer ? [{ uniqueId: payer, name: getName(payer) }] : []),
        ...allParticipants.filter(p => selectedParticipants.includes(p.uniqueId))
    ], [includeMe, includePayer, payer, allParticipants, selectedParticipants, getName]);

    const validation = useMemo(() => {
        if (isIncome || isSettlement) return { isValid: true, message: '' };
        const amountInRupees = parseFloat(amount);
        if (isNaN(amountInRupees) || amountInRupees === 0) return splitMethod === 'dynamic' ? { isValid: false, message: 'Enter a total amount first.' } : { isValid: true, message: '' };
        const amountInPaise = Math.round(amountInRupees * 100);
        return validateSplits(amountInPaise, splits, splitMethod);
    }, [amount, splits, splitMethod, isIncome, isSettlement]);

    const saveTransactionLogic = async () => {
        const amountInPaise = Math.round(parseFloat(amount) * 100);
        const multiplier = isProductRefund ? -1 : 1;
        const finalAmount = amountInPaise * multiplier;

        let safeParticipants = selectedParticipants;
        if (isSettlement || isForgiveness) {
            // Settlement/Forgiveness Logic: Ensure non-empty participants
            if (!selectedParticipants || selectedParticipants.length === 0) {
                // Default to payer? No, settlement/forgiveness must have a recipient.
                // We rely on handleSubmit validation, but for safety, filter empty.
            }
        } else {
            if (!selectedParticipants.length && payer === 'me') safeParticipants = []; // Just me
        }

        if (!isSettlement && !isForgiveness && payer !== 'me' && !selectedParticipants.includes(payer) && includePayer) {
            safeParticipants = [...safeParticipants, payer];
        }

        let finalSplits = { ...splits };
        if (!isSettlement && !isForgiveness && !isIncome && splitMethod === 'equal') {
            const involvedCount = splitAllocatorParticipants.length;
            if (involvedCount > 0) {
                const absAmount = Math.abs(amountInPaise);
                const share = Math.floor(absAmount / involvedCount);
                const remainder = absAmount % involvedCount;
                finalSplits = {};
                splitAllocatorParticipants.forEach((p, index) => {
                    let val = share;
                    if (index < remainder) val += 1;
                    finalSplits[p.uniqueId] = val * multiplier;
                });
            }
        } else {
            Object.keys(finalSplits).forEach(key => {
                if (splitMethod === 'percentage') {
                    const percent = finalSplits[key];
                    const share = Math.round((percent / 100) * Math.abs(amountInPaise));
                    finalSplits[key] = share * multiplier;
                } else {
                    finalSplits[key] = finalSplits[key] * multiplier;
                }
            });
        }



        // Calculate proportional allocations for linked transactions
        // If the user manually changed the total amount, we need to scale the linked allocations
        let linkedTransactionsData = [];
        if (linkedTxns.length > 0) {
            // ROBUSTNESS FIX: Re-calculate totalAllocated using source of truth (eligibleParents)
            // This bypasses any potential state corruption in linkedTxns
            const robustLinks = linkedTxns.map(t => {
                const parent = groupTransactions.find(p => p.id === t.id);
                // Calculate outstanding debt freshly to ensure accuracy
                const debtorId = payer;
                const outstanding = parent ? getOutstandingDebt(parent, debtorId) : (parseFloat(t.allocated) * 100);

                // Convert to Rupees for ratio calculation
                const robustAlloc = outstanding / 100;

                return { ...t, robustAlloc };
            });

            const totalAllocated = robustLinks.reduce((sum, t) => sum + t.robustAlloc, 0);
            const formAmount = parseFloat(amount);

            if (totalAllocated !== 0 && Math.abs(totalAllocated - formAmount) > 0.01) {
                // User changed the amount - redistribute proportionally
                const ratio = formAmount / totalAllocated;
                console.log(`[SAVE DEBUG] Reformatted: Form=${formAmount}, TotalAlloc=${totalAllocated}, Ratio=${ratio}`);
                let currentSum = 0;

                linkedTransactionsData = robustLinks.map((t, index) => {
                    if (index === robustLinks.length - 1) {
                        // Last item absorbs rounding difference
                        const remaining = Math.round(formAmount * 100) - currentSum;
                        console.log(`[SAVE DEBUG] LastItem ${t.name}: Remaining=${remaining}`);
                        return { id: t.id, amount: remaining * multiplier };
                    }

                    const scaledAmount = (t.robustAlloc * ratio);
                    const roundedAmount = Math.round(scaledAmount * 100);
                    currentSum += roundedAmount;
                    console.log(`[SAVE DEBUG] Item ${t.name}: RobustAlloc=${t.robustAlloc}, Scaled=${scaledAmount}, Rounded=${roundedAmount}`);

                    return { id: t.id, amount: roundedAmount * multiplier };
                });
            } else {
                // Amounts match, just use allocated values
                linkedTransactionsData = linkedTxns.map(t => ({
                    id: t.id,
                    amount: Math.round(parseFloat(t.allocated) * 100) * multiplier
                }));
            }
        }
        const parentIds = linkedTransactionsData.map(t => t.id);

        // Ensure we don't pass undefined values to Firebase
        const participantForSettlement = safeParticipants[0] || null;
        const firstParentId = parentIds.length > 0 ? parentIds[0] : null;

        let txnData = {
            expenseName: name, amount: finalAmount, type: (isSettlement || isForgiveness) ? 'expense' : type,
            category: category.startsWith('add_new') ? '' : category,
            place: place.startsWith('add_new') ? '' : place,
            tag: tag.startsWith('add_new') ? '' : tag,
            modeOfPayment: isMultiMode ? 'Multi' : (mode.startsWith('add_new') ? '' : mode),
            // Multi-Mode Payment Breakdown
            paymentBreakdown: isMultiMode
                ? paymentBreakdown.map(p => ({
                    mode: p.mode,
                    amount: Math.round(parseFloat(p.amount) * 100) * multiplier
                }))
                : [{ mode: mode.startsWith('add_new') ? '' : mode, amount: amountInPaise * multiplier }],
            description: isForgiveness ? `Debt Forgiven: ${description}`.trim() : description,
            timestamp: Timestamp.fromDate(new Date(date)),
            dateString: date,
            payer: isIncome ? 'me' : payer,
            isReturn: isSettlement || isForgiveness,
            isForgiveness: isForgiveness || false,
            participants: isIncome ? [] : ((isSettlement || isForgiveness) ? (participantForSettlement ? [participantForSettlement] : []) : safeParticipants),
            splitMethod: (isSettlement || isForgiveness || isIncome) ? 'none' : splitMethod,
            splits: (isSettlement || isForgiveness || isIncome) ? {} : finalSplits,
            linkedTransactions: linkedTransactionsData, parentTransactionIds: parentIds,
            parentTransactionId: firstParentId, isLinkedRefund: parentIds.length > 0,
            groupId: formGroupId
        };

        // Apply smart tagging rules (auto-fill empty category/tag/mode based on expense name)
        if (!isEditMode && smartRules && smartRules.length > 0) {
            txnData = applySmartRules(txnData, smartRules);
        }

        try {
            if (isEditMode) {
                await updateTransaction(initialData.id, txnData, initialData.parentTransactionId);
                setShowSuccess(true);
                setTimeout(() => { setShowSuccess(false); navigate('/history'); }, 1200);
            } else {
                await addTransaction(txnData);
                setShowSuccess(true);
                setTimeout(() => { setShowSuccess(false); navigate('/history'); }, 1200);
            }
        } catch (e) { console.error(e); showToast("Error saving: " + e.message, true); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const amountInRupees = parseFloat(amount);
        if (!name || isNaN(amountInRupees)) { showToast("Please enter valid name and amount", true); return; }
        if (!isSettlement && !isIncome && !validation.isValid) {
            showToast(validation.message || "Please fix split errors.", true);
            return;
        }
        if (!isEditMode) {
            const checkAmount = Math.round(amountInRupees * 100);
            const potentialDupe = groupTransactions.find(t => {
                if (!t.timestamp) return false;
                const tDate = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
                if (isNaN(tDate.getTime())) return false;
                return Math.abs(t.amount) === checkAmount && t.expenseName === name && tDate.toISOString().split('T')[0] === date;
            });
            if (potentialDupe) {
                setDupeTxn(potentialDupe);
                setShowDupeModal(true);
                return;
            }
        }
        saveTransactionLogic();
    };

    const handleManualSwap = () => {
        const oldPayer = payer;
        const oldRecipient = selectedParticipants[0];
        if (oldPayer && oldRecipient && oldRecipient !== oldPayer) {
            setPayer(oldRecipient);
            setSelectedParticipants([oldPayer]);
            const invertedLinks = linkedTxns.map(l => ({ ...l, allocated: (parseFloat(l.allocated) * -1).toFixed(2) }));
            setLinkedTxns(invertedLinks);
        }
    };

    const forceSubmit = () => { setShowDupeModal(false); saveTransactionLogic(); };

    return {
        // 1. Form Data (Values)
        formData: {
            formGroupId,
            name, amount, date, category, place, tag, mode, description,
            type, refundSubType, payer, selectedParticipants,
            splitMethod, splits, includeMe, includePayer, repaymentFilter,
            // Multi-Mode Payment
            isMultiMode, paymentBreakdown
        },

        // 2. Setters (Actions to change data)
        setters: {
            setFormGroupId,
            setName, setAmount, setDate, setCategory, setPlace, setTag, setMode, setDescription,
            setPayer, setSelectedParticipants, setSplitMethod, setSplits, setIncludeMe, setIncludePayer,
            setRepaymentFilter, setType, setRefundSubType,
            // Multi-Mode setters
            setIsMultiMode, setPaymentBreakdown
        },

        // 3. UI State (Modals, Loading, Success)
        ui: {
            showDupeModal, setShowDupeModal, dupeTxn, setDupeTxn,
            activePrompt, setActivePrompt,
            suggestion, setSuggestion,
            showSuccess,
            // Computed booleans
            isRefundTab, isSettlement, isForgiveness, isProductRefund, isIncome
        },

        // 4. Linked Transaction Logic
        links: {
            items: linkedTxns,
            set: setLinkedTxns,
            tempId: tempSelectId,
            setTempId: setTempSelectId,
            handleSelect: handleLinkSelect,
            remove: removeLinkedTxn,
            updateAlloc: updateLinkedAllocation,
            totalAllocated: linkedTxns.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0),
            allocationDiff: (parseFloat(amount) || 0) - linkedTxns.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0),
            isValid: Math.abs((parseFloat(amount) || 0) - linkedTxns.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0)) < 0.05
        },

        // 5. Participants & Data Sources
        data: {
            allParticipants,
            splitAllocatorParticipants,
            groupTransactions,
            eligibleParents,
            // Options from store
            groups, categories, places, tags, modesOfPayment
        },

        // 6. High Level Actions
        actions: {
            handlePayerChange, handleRecipientChange,
            handleParticipantAdd, handleParticipantRemove, handleGroupAdd,
            handleQuickAddRequest, handlePromptConfirm,
            handleTemplateSaveRequest, handleManualSwap, applySuggestion,
            handleSubmit, forceSubmit, resetForm,
            handleTypeChange, handleRefundSubTypeChange,
            handleAmountChange,
            // Multi-Mode actions
            addPaymentMode, removePaymentMode, updatePaymentMode, autoFillLastMode
        },

        // 7. Utilities
        utils: {
            getTxnDateStr, getName, validation,
            // Multi-Mode utilities
            getMultiModeRemaining
        }
    };
};