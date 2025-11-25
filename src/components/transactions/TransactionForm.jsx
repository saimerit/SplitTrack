import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp, addDoc, collection } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import useAppStore from '../../store/useAppStore';
import { addTransaction, updateTransaction } from '../../services/transactionService';
import { validateSplits } from '../../utils/validators';
import { formatCurrency } from '../../utils/formatters';
import { Trash2, RefreshCw, HandCoins, Filter, Sparkles } from 'lucide-react';
import Fuse from 'fuse.js';

import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import SplitAllocator from './SplitAllocator';
import ParticipantSelector from './ParticipantSelector';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';

// --- HELPERS ---
const getTxnDateStr = (txn) => {
    if (!txn?.timestamp) return '';
    const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const getTxnTime = (txn) => {
    if (!txn?.timestamp) return 0;
    return txn.timestamp.toMillis ? txn.timestamp.toMillis() : new Date(txn.timestamp).getTime();
};

const generateSmartName = (links, subTypeStr) => {
    if (!links || links.length === 0) return "";
    const prefix = (subTypeStr === 'settlement') ? "Repayment" : "Refund";
    return `${prefix}: ` + links.map(t => t.name).join(', ');
};

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
  const navigate = useNavigate();
  const { 
    categories, places, tags, modesOfPayment, participants, transactions,
    userSettings, showToast, participantsLookup
  } = useAppStore();
  
  const wasMeIncluded = initialData?.splits ? (initialData.splits['me'] !== undefined) : true;

  // --- INIT LOGIC ---
  const getInitialType = () => {
      if (initialData?.isReturn) return 'refund';
      if (initialData && initialData.amount < 0) return 'refund';
      return initialData?.type || 'expense';
  };

  const getInitialSubType = () => {
      if (initialData?.isReturn) return 'settlement';
      return 'product'; 
  };

  const [type, setType] = useState(getInitialType());
  const [refundSubType, setRefundSubType] = useState(getInitialSubType()); 

  const isRefundTab = type === 'refund';
  const isSettlement = isRefundTab && refundSubType === 'settlement'; 
  const isProductRefund = isRefundTab && refundSubType === 'product'; 
  const isIncome = type === 'income';

  const [name, setName] = useState(initialData?.expenseName || '');
  const [amount, setAmount] = useState(initialData ? (Math.abs(initialData.amount)/100).toFixed(2) : '');
  
  const getInitialDate = () => {
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
  };

  const [date, setDate] = useState(getInitialDate());
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
  const hasInitializedLinks = useRef(false);
  
  const [splitMethod, setSplitMethod] = useState(initialData?.splitMethod || 'equal');
  const [splits, setSplits] = useState(initialData?.splits || {}); 
  const [includeMe, setIncludeMe] = useState(wasMeIncluded);
  
  const [includePayer, setIncludePayer] = useState(false);
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [dupeTxn, setDupeTxn] = useState(null);
  const [activePrompt, setActivePrompt] = useState(null); 
  
  // Smart Suggestion State
  const [suggestion, setSuggestion] = useState(null);

  // --- FEATURE: Smart Category Suggestions ---
  useEffect(() => {
        if (isEditMode || !name || name.length < 3) {
            if (suggestion !== null) {
                Promise.resolve().then(() => setSuggestion(null));
            }
            return;
        }

        const timer = setTimeout(() => {
            const fuse = new Fuse(transactions.slice(0, 500), {
                keys: ['expenseName'],
                threshold: 0.3
            });
            const result = fuse.search(name);

            if (result.length > 0) {
                const bestMatch = result[0].item;

                if ((!category && bestMatch.category) ||
                    (!place && bestMatch.place) ||
                    (!tag && bestMatch.tag)) 
                {
                    setSuggestion(bestMatch);
                } else {
                    Promise.resolve().then(() => setSuggestion(null));
                }
            } else {
                Promise.resolve().then(() => setSuggestion(null));
            }
        }, 500);

        return () => clearTimeout(timer);

    }, [name, isEditMode, transactions, category, place, tag, suggestion]);



  const applySuggestion = () => {
      if (!suggestion) return;
      if (suggestion.category && !category) setCategory(suggestion.category);
      if (suggestion.place && !place) setPlace(suggestion.place);
      if (suggestion.tag && !tag) setTag(suggestion.tag);
      setSuggestion(null);
      showToast("Autofilled details!");
  };

  // --- FEATURE: Include Payer Logic ---
    useEffect(() => {
        if (!isEditMode || !initialData) return;
        const initialPayer = initialData.payer || 'me';
        const shouldInclude =
            initialPayer !== 'me' &&
            initialData.splits &&
            initialData.splits[initialPayer] !== undefined;
        if (shouldInclude) {
            Promise.resolve().then(() => setIncludePayer(true));   
        }
    }, [isEditMode, initialData]);
    
    useEffect(() => {
        if (payer === 'me') {
            Promise.resolve().then(() => setIncludePayer(false));   
        }
    }, [payer]);

  // --- SMART NAME LOGIC ---
  const updateSmartName = (links, subTypeStr) => {
      const smartName = generateSmartName(links, subTypeStr);
      if (!smartName) return;
      if (!name || name.startsWith("Refund:") || name.startsWith("Repayment:")) {
          setName(smartName);
      }
  };

  const getName = (uid) => {
      if (uid === 'me') return 'You';
      return participantsLookup.get(uid)?.name || uid;
  };

  // --- OUTSTANDING DEBT CALCULATION ---
  const getOutstandingDebt = useCallback((parentTxn, debtorId) => {
      // 1. Original Debt (in Paise)
      let debt = parentTxn.splits?.[debtorId] || 0;

      // 2. Filter related transactions
      const related = transactions.filter(t => {
          if (isEditMode && t.id === initialData?.id) return false;
          if (t.parentTransactionId === parentTxn.id) return true;
          if (t.parentTransactionIds && t.parentTransactionIds.includes(parentTxn.id)) return true;
          return false;
      });

      related.forEach(rel => {
          if (rel.isReturn) {
              // Check specific link allocation
              const link = rel.linkedTransactions?.find(l => l.id === parentTxn.id);
              if (link) {
                  // Standard: Debtor paid Payer
                  if (rel.payer === debtorId) {
                      debt -= Math.abs(link.amount);
                  } 
                  // Contra: Payer (Creditor) paid Debtor (Offset)
                  else if (rel.payer !== debtorId && link.amount < 0) {
                      debt -= Math.abs(link.amount);
                  }
              } else if (rel.payer === debtorId && (!rel.linkedTransactions || rel.linkedTransactions.length === 0)) {
                  // Legacy
                  debt -= Math.abs(rel.amount);
              }
          } else if (rel.amount < 0) {
              // Refunds reduce debt
              let refundShare = rel.splits?.[debtorId] || 0;
              debt += refundShare; // refundShare is negative
          }
      });

      return Math.max(0, debt);
  }, [transactions, isEditMode, initialData]);

  // --- LINKED TRANSACTIONS INIT ---
  useEffect(() => {
      hasInitializedLinks.current = false;
  }, [initialData?.id]);

  useEffect(() => {
      if (hasInitializedLinks.current || transactions.length === 0) return;

      let linksToSet = [];
      let shouldUpdate = false;

      if (initialData && initialData.linkedTransactions) {
          linksToSet = initialData.linkedTransactions.map(link => {
              const original = transactions.find(t => t.id === link.id);
              const full = original ? Math.abs(original.amount) : 0;
              
              return {
                  id: link.id,
                  name: original ? original.expenseName : 'Unknown',
                  dateStr: getTxnDateStr(original),
                  timestamp: getTxnTime(original),
                  fullAmount: full,
                  maxAllocatable: full, 
                  allocated: (link.amount / 100).toFixed(2)
              };
          });
          shouldUpdate = true;
      }

      if (shouldUpdate) {
          setTimeout(() => {
              setLinkedTxns(linksToSet);
              const currentSubType = initialData?.isReturn ? 'settlement' : 'product';
              const smartName = generateSmartName(linksToSet, currentSubType);
              if (!initialData?.expenseName) {
                  setName(smartName);
              }
              hasInitializedLinks.current = true;
          }, 0);
      }
  }, [initialData, transactions]);

  // --- MEMOIZED HELPERS ---
  const eligibleParents = useMemo(() => {
    if (!isSettlement) {
        return transactions
            .filter(t => t.amount > 0 && !t.isReturn && !t.isDeleted) // Safety Patch: Filter deleted
            .filter(t => !linkedTxns.some(l => l.id === t.id))
            .sort((a, b) => getTxnTime(b) - getTxnTime(a));
    }

    // SETTLEMENT LOGIC
    // 1. Debts I Owe (Positive Link)
    const debtsIOwe = transactions.filter(t => 
        !t.isReturn && t.payer !== 'me' && t.splits?.['me'] > 0 && !t.isDeleted
    ).map(t => ({ 
        ...t, 
        relationType: 'owed_by_me', // I owe them
        counterParty: t.payer,
        outstanding: getOutstandingDebt(t, 'me')
    }));

    // 2. Debts Others Owe Me (Negative Link / Offset)
    const debtsTheyOwe = transactions.filter(t => 
        !t.isReturn && t.payer === 'me' && !t.isDeleted &&
        Object.keys(t.splits || {}).some(uid => uid !== 'me' && t.splits[uid] > 0)
    ).flatMap(t => {
        return Object.keys(t.splits)
            .filter(uid => uid !== 'me' && t.splits[uid] > 0)
            .map(uid => ({
                ...t,
                relationType: 'owed_to_me', // They owe me
                counterParty: uid,
                outstanding: getOutstandingDebt(t, uid)
            }));
    });

    let all = [...debtsIOwe, ...debtsTheyOwe];

    // FILTER LOGIC: Prioritize Dropdown Filter
    if (repaymentFilter) {
        all = all.filter(t => t.counterParty === repaymentFilter);
    } 
    else if (payer !== 'me') {
        all = all.filter(t => t.counterParty === payer);
    }
    else if (selectedParticipants.length === 1 && selectedParticipants[0] !== 'me') {
        all = all.filter(t => t.counterParty === selectedParticipants[0]);
    }

    // Remove settled items and items already linked
    const result = all
        .filter(t => t.outstanding > 10) // Ignore dust < 10 paise
        .filter(t => !linkedTxns.some(l => l.id === t.id))
        .sort((a, b) => getTxnTime(b) - getTxnTime(a));

    // FIX APPLIED: Strictly remove duplicates by ID
    return [...new Map(result.map(item => [item.id, item])).values()];

  }, [transactions, linkedTxns, isSettlement, payer, selectedParticipants, repaymentFilter, getOutstandingDebt]);

  const showIncludePayerCheckbox = payer !== 'me' && !selectedParticipants.includes(payer);
  
  const splitAllocatorParticipants = useMemo(() => [
      ...(includeMe ? [{ uniqueId: 'me', name: 'You' }] : []),
      ...(showIncludePayerCheckbox && includePayer 
          ? (() => {
             const p = participants.find(x => x.uniqueId === payer);
             return p ? [p] : [];
            })() 
          : []),
      ...participants.filter(p => selectedParticipants.includes(p.uniqueId))
  ], [includeMe, showIncludePayerCheckbox, includePayer, payer, participants, selectedParticipants]);

  const validation = useMemo(() => {
    if (isIncome || isSettlement) return { isValid: true, message: '' };
    const amountInRupees = parseFloat(amount);
    if (isNaN(amountInRupees) || amountInRupees === 0) {
        return splitMethod === 'dynamic' 
            ? { isValid: false, message: 'Enter a total amount first.' }
            : { isValid: true, message: '' };
    }
    const amountInPaise = Math.round(amountInRupees * 100);
    return validateSplits(amountInPaise, splits, splitMethod);
  }, [amount, splits, splitMethod, isIncome, isSettlement]);

  // --- HANDLERS ---
  
  const autoUpdateTotal = (currentLinks) => {
      const total = currentLinks.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0);
      setAmount(total.toFixed(2));
  };

  const handleAmountChange = (e) => {
      const newAmountStr = e.target.value;
      setAmount(newAmountStr);

      if ((isSettlement || isProductRefund) && linkedTxns.length > 0) {
          let remainingCash = parseFloat(newAmountStr) || 0;
          
          // Sum of offsets (Negative allocations)
          const offsetTotal = linkedTxns.reduce((sum, t) => {
              const val = parseFloat(t.allocated) || 0;
              return val < 0 ? sum + Math.abs(val) : sum; 
          }, 0);

          // Total value we can distribute to positive debts = Cash + Offsets
          let fundsAvailable = remainingCash + offsetTotal;

          const newLinks = linkedTxns.map(t => ({ ...t }));
          
          // Sort positive debts by date (FIFO)
          const positiveIndices = newLinks
            .map((t, i) => ({ ...t, index: i }))
            .filter(t => parseFloat(t.maxAllocatable) > 0 && parseFloat(t.allocated) >= 0)
            .sort((a, b) => a.timestamp - b.timestamp);

          positiveIndices.forEach(item => {
              const maxRupees = item.maxAllocatable / 100;
              const allocated = Math.min(maxRupees, fundsAvailable);
              
              newLinks[item.index].allocated = allocated.toFixed(2);
              fundsAvailable = Math.max(0, fundsAvailable - allocated);
          });

          setLinkedTxns(newLinks);
      }
  };

  const addLinkedTxn = (e) => {
      const pid = e.target.value;
      if (!pid) return;
      
      const parentCtx = eligibleParents.find(t => t.id === pid);
      const parent = parentCtx || transactions.find(t => t.id === pid);

      if (parent) {
           if (isSettlement) {
               const inferredCounterParty = parentCtx ? parentCtx.counterParty : (parent.payer === 'me' ? Object.keys(parent.splits).find(k => k!=='me') : parent.payer);
               
               if (payer === 'me') {
                   if (selectedParticipants.length === 0 && inferredCounterParty) {
                       setSelectedParticipants([inferredCounterParty]);
                   }
               }
           }

           const outstanding = parentCtx ? parentCtx.outstanding : Math.abs(parent.amount);
           
           // Determine Relation Type & Auto-Switch Form
           const isOwedToMe = parentCtx?.relationType === 'owed_to_me'; 
           const isOwedByMe = parentCtx?.relationType === 'owed_by_me'; 
           const counterParty = parentCtx?.counterParty;

           if (isSettlement && counterParty) {
               // Auto-set Payer/Recipient based on debt type
               if (isOwedToMe) {
                   setPayer(counterParty);
                   setSelectedParticipants(['me']);
               } else if (isOwedByMe) {
                   setPayer('me');
                   setSelectedParticipants([counterParty]);
               }
               // Sync filter
               if (!repaymentFilter) {
                   setRepaymentFilter(counterParty);
               }
           }

           const outstandingRupees = outstanding / 100;
           
           // Allocation Sign Logic
           const nextPayer = isOwedToMe ? counterParty : (isOwedByMe ? 'me' : payer);
           let allocValue = outstandingRupees;
           
           if (nextPayer === 'me' && isOwedToMe) {
               allocValue = -outstandingRupees;
           }

           const currentTotal = parseFloat(amount) || 0;
           const newTotal = currentTotal + allocValue;

           const newLink = {
               id: parent.id,
               name: parent.expenseName,
               dateStr: getTxnDateStr(parent),
               timestamp: getTxnTime(parent),
               fullAmount: Math.abs(parent.amount),
               maxAllocatable: outstanding, 
               allocated: allocValue.toFixed(2),
               relationType: parentCtx?.relationType || 'unknown'
           };
           
           const updatedLinks = [...linkedTxns, newLink];
           setLinkedTxns(updatedLinks);
           setAmount(newTotal.toFixed(2)); 
           updateSmartName(updatedLinks, refundSubType);
      }
      setTempSelectId('');
  };

  const removeLinkedTxn = (id) => {
      const updatedLinks = linkedTxns.filter(t => t.id !== id);
      setLinkedTxns(updatedLinks);
      autoUpdateTotal(updatedLinks); 
      updateSmartName(updatedLinks, refundSubType);
  };

  const updateLinkedAllocation = (id, val) => {
      const updatedLinks = linkedTxns.map(t => 
          t.id === id ? { ...t, allocated: val } : t
      );
      setLinkedTxns(updatedLinks);
      autoUpdateTotal(updatedLinks);
  };

  const handleSubTypeChange = (newType) => {
      setRefundSubType(newType);
      setLinkedTxns([]);
      setAmount('');
      setName('');
  };

  const totalAllocated = linkedTxns.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0);
  const formAmount = parseFloat(amount) || 0;
  const allocationDiff = formAmount - totalAllocated;
  const isAllocationValid = Math.abs(allocationDiff) < 0.05;

  const handleQuickAddRequest = (value, collectionName, label) => {
    if (value === `add_new_${collectionName}`) {
        setActivePrompt({ type: 'quickAdd', targetCollection: collectionName, targetLabel: label, title: `Add New ${label}`, label: `New ${label} Name` });
    } else {
        if(collectionName === 'categories') setCategory(value);
        if(collectionName === 'places') setPlace(value);
        if(collectionName === 'tags') setTag(value);
        if(collectionName === 'modesOfPayment') setMode(value);
    }
  };

  const handleTemplateSaveRequest = () => {
      setActivePrompt({ type: 'template', title: 'Save as Template', label: 'Template Name' });
  };

  const handleCancel = () => navigate(-1);

  // --- RESET FORM ---
  const resetForm = () => {
      setName('');
      setAmount('');
      setLinkedTxns([]);
      setSplits({});
      setIncludeMe(true);
      setIncludePayer(false);
      setDescription('');
      setSuggestion(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const executeTemplateSave = async (templateName) => {
    const amountInRupees = parseFloat(amount);
    const multiplier = isProductRefund ? -1 : 1;
    const finalAmount = !isNaN(amountInRupees) ? Math.round(amountInRupees * 100) * multiplier : null;

    const templateData = {
        name: templateName, expenseName: name, amount: finalAmount, 
        type: isSettlement ? 'expense' : type, 
        category, place, tag, modeOfPayment: mode, description,
        payer: isIncome ? 'me' : payer, 
        isReturn: isSettlement, 
        participants: isIncome ? [] : (isSettlement ? [selectedParticipants[0]] : selectedParticipants),
        splitMethod: (isSettlement || isIncome) ? 'none' : splitMethod,
        splits: (isSettlement || isIncome) ? {} : splits,
    };
    try {
        await addDoc(collection(db, 'ledgers/main-ledger/templates'), templateData);
        showToast("Template saved successfully!");
    } catch (error) { console.error(error); showToast("Failed to save template.", true); }
  };

  const handlePromptConfirm = async (inputValue) => {
      if (!inputValue) return;
      const { type: promptType, targetCollection, targetLabel } = activePrompt || {};
      
      if (promptType === 'quickAdd') {
          try {
              await addDoc(collection(db, `ledgers/main-ledger/${targetCollection}`), { name: inputValue });
              showToast(`${targetLabel} added!`);
              if(targetCollection === 'categories') setCategory(inputValue);
              if(targetCollection === 'places') setPlace(inputValue);
              if(targetCollection === 'tags') setTag(inputValue);
              if(targetCollection === 'modesOfPayment') setMode(inputValue);
          } catch (e) {
               console.error(e);
               showToast(`Failed to add ${targetLabel}.`, true); 
          }
      } else if (promptType === 'template') {
          await executeTemplateSave(inputValue);
      }
      setActivePrompt(null);
  };

  const saveTransaction = async () => {
       const amountInPaise = Math.round(parseFloat(amount) * 100);
       const multiplier = isProductRefund ? -1 : 1;
       const finalAmount = amountInPaise * multiplier;
       
       let safeParticipants = selectedParticipants;
       if (isSettlement && (!selectedParticipants || selectedParticipants.length === 0)) {
           safeParticipants = ['me'];
       }
       if (showIncludePayerCheckbox && includePayer) {
           safeParticipants = [...safeParticipants, payer];
       }

       let finalSplits = { ...splits }; 
       if (!isSettlement && !isIncome && splitMethod === 'equal') {
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

       const linkedTransactionsData = linkedTxns.map(t => ({
           id: t.id,
           amount: Math.round(parseFloat(t.allocated) * 100) * multiplier
       }));
       const parentIds = linkedTransactionsData.map(t => t.id);

       const txnData = {
         expenseName: name, 
         amount: finalAmount, 
         type: isSettlement ? 'expense' : type, 
         category: category.startsWith('add_new') ? '' : category, 
         place: place.startsWith('add_new') ? '' : place, 
         tag: tag.startsWith('add_new') ? '' : tag,
         modeOfPayment: mode.startsWith('add_new') ? '' : mode, 
         description,
         timestamp: Timestamp.fromDate(new Date(date)), 
         payer: isIncome ? 'me' : payer,
         isReturn: isSettlement, 
         participants: isIncome ? [] : (isSettlement ? [safeParticipants[0]] : safeParticipants),
         splitMethod: (isSettlement || isIncome) ? 'none' : splitMethod,
         splits: (isSettlement || isIncome) ? {} : finalSplits,
         
         linkedTransactions: linkedTransactionsData,
         parentTransactionIds: parentIds,
         parentTransactionId: parentIds.length > 0 ? parentIds[0] : null,
         isLinkedRefund: parentIds.length > 0
       };

       try {
         if (isEditMode) {
            await updateTransaction(initialData.id, txnData, initialData.parentTransactionId);
            showToast("Transaction updated!");
            navigate(-1);
         } else {
            await addTransaction(txnData);
            showToast("Transaction added successfully!");
            resetForm(); 
         }
       } catch(e) { console.error(e); showToast("Error saving: " + e.message, true); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountInRupees = parseFloat(amount);
    if (!name || isNaN(amountInRupees)) {
        showToast("Please enter valid name and amount", true);
        return;
    }
    if (!isSettlement && !isIncome && !validation.isValid) {
        showToast(validation.message || "Please fix split errors.", true);
        return;
    }
    
    if (isProductRefund && linkedTxns.length > 0) {
        for (const link of linkedTxns) {
            const allocatedPaise = Math.round(parseFloat(link.allocated) * 100);
            if (allocatedPaise > link.fullAmount) {
                 showToast(`Refund for "${link.name}" cannot exceed original amount (${formatCurrency(link.fullAmount)}).`, true);
                 return;
            }
        }
    }
    
    if ((isProductRefund || isSettlement) && linkedTxns.length > 0 && !isAllocationValid) {
        showToast(`Allocated total does not match transaction amount. Difference: ${formatCurrency(allocationDiff * 100)}`, true);
        return;
    }

    if (!isEditMode) {
        const checkAmount = Math.round(amountInRupees * 100);
        const potentialDupe = transactions.find(t => {
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
    saveTransaction();
  };

  const forceSubmit = async () => { setShowDupeModal(false); saveTransaction(); };

  const mapOptions = (items, collectionName, label) => [
      { value: "", label: "-- Select --" }, 
      ...items.map(i => ({ value: i.name, label: i.name })),
      { value: `add_new_${collectionName}`, label: `+ Add New ${label}`, className: "text-sky-600 font-bold bg-sky-50 dark:bg-gray-700 dark:text-sky-400" }
  ];
  
  return (
    <>
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      
      {/* Transaction Type */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Type</label>
        <div className="flex flex-col sm:flex-row gap-4">
          {['expense', 'income', 'refund'].map(t => (
            <label key={t} className="flex-1 cursor-pointer group">
              <input type="radio" name="txnType" value={t} checked={type === t} onChange={() => setType(t)} className="peer sr-only" />
              <div className={`
                text-center py-3 rounded-lg border transition-all font-medium capitalize
                ${type === t 
                  ? (t === 'expense' ? 'bg-red-50 text-red-700 border-red-500 dark:bg-red-900/20 dark:text-red-400' : 
                     t === 'income' ? 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-900/20 dark:text-blue-400' : 
                     'bg-green-50 text-green-700 border-green-500 dark:bg-green-900/20 dark:text-green-400')
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}
              `}>
                {t === 'expense' ? 'Expense (Out)' : t === 'income' ? 'Income (In)' : 'Refund / Repayment'}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Refund Subtype Switcher */}
      {isRefundTab && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What kind of return is this?</label>
              <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => handleSubTypeChange('product')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm border transition-colors ${isProductRefund 
                        ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                  >
                      <RefreshCw size={16} /> Product Refund
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubTypeChange('settlement')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm border transition-colors ${isSettlement 
                        ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}
                  >
                      <HandCoins size={16} /> Peer Settlement
                  </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                  {isProductRefund ? "Use this when you return an item and get money back (Negative Expense)." : "Use this when paying back a friend to settle debts (Repayment)."}
              </p>
          </div>
      )}

      <div className="col-span-1 md:col-span-2 lg:col-span-4 relative">
        <Input 
            label="Expense Name" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            required 
            placeholder={isSettlement ? "Repayment" : "e.g. Dinner at Taj"} 
        />
        {suggestion && (
            <div 
                onClick={applySuggestion}
                className="absolute z-10 top-[70px] left-0 right-0 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 shadow-lg cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-3 animate-fade-in"
            >
                <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
                <div className="text-sm text-indigo-900 dark:text-indigo-200">
                    <span className="font-bold">Suggestion found:</span> {suggestion.category} • {suggestion.place} • {suggestion.tag}
                </div>
            </div>
        )}
      </div>

      {/* MOVED: Payer & Recipient Selectors (Above Linking) */}
      <div className="col-span-1 md:col-span-1 lg:col-span-2">
         {!isIncome && (
            <Select label={isSettlement ? "Who is paying?" : "Who paid?"} value={payer} onChange={e => setPayer(e.target.value)} options={[{ value: "me", label: "You (me)" }, ...participants.map(p => ({ value: p.uniqueId, label: p.name }))]} />
         )}
      </div>
      
      {isSettlement && (
         <div className="col-span-1 md:col-span-1 lg:col-span-2">
             <Select label="Who is being repaid?" value={selectedParticipants[0] || ''} onChange={e => setSelectedParticipants([e.target.value])} options={[{ value: "me", label: "You (me)" }, ...participants.map(p => ({ value: p.uniqueId, label: p.name }))]} />
         </div>
      )}

      {/* LINKING SECTION */}
      {(isProductRefund || isSettlement) && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                
                {/* RESTORED: Filter Dropdown in Blue Box */}
                {isSettlement && (
                    <div className="mb-4">
                        <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1 flex items-center gap-2">
                            <Filter size={12} /> Filter by Debtor (Show Debts)
                        </label>
                        <Select 
                            value={repaymentFilter} 
                            onChange={e => {
                                setRepaymentFilter(e.target.value);
                                setLinkedTxns([]); 
                                setAmount('');
                            }}
                            options={[{ value: '', label: '-- Show All --' }, ...participants.map(p => ({ value: p.uniqueId, label: p.name }))]}
                            className="w-full md:w-1/2"
                        />
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
                            Select a person to see expenses involving them.
                        </p>
                    </div>
                )}

                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link to Original Expense(s)</label>
                <Select value={tempSelectId} onChange={addLinkedTxn} options={[{ value: '', label: '-- Select Expense to Link --' }, ...eligibleParents.map(t => {
                    const isOwedToMe = t.relationType === 'owed_to_me';
                    const sign = isOwedToMe ? '-' : '';
                    const colorClass = isOwedToMe ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400';
                    const prefix = isOwedToMe ? `[${getName(t.counterParty)} owes You] ` : `[You owe ${getName(t.counterParty)}] `;
                    
                    return { 
                        value: t.id, 
                        label: `${prefix}${t.expenseName} (${sign}₹${(t.outstanding/100).toFixed(2)}) - ${getTxnDateStr(t)}`,
                        className: colorClass
                    };
                })]} />
                
                {linkedTxns.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {linkedTxns.map((link) => {
                            const isNegative = parseFloat(link.allocated) < 0;
                            const colorClass = isNegative ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                            return (
                                <div key={link.id} className={`flex items-center gap-2 p-2 rounded border ${isNegative ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                                    <span className={`text-sm flex-1 dark:text-gray-300 truncate ${colorClass}`} title={link.name}>
                                        {link.name} <span className="text-xs text-gray-500">({formatCurrency(link.maxAllocatable)})</span>
                                    </span>
                                    <span className={`text-sm ${isNegative ? 'text-green-600 font-bold' : 'text-gray-500'}`}>
                                        {isNegative ? 'Offset: ' : 'Pay: '}₹
                                    </span>
                                    <input 
                                        type="number" 
                                        value={link.allocated} 
                                        onChange={(e) => updateLinkedAllocation(link.id, e.target.value)} 
                                        className={`w-24 px-1 py-1 text-sm border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 ${isNegative ? 'text-green-600 border-green-300' : 'text-red-600 border-red-300'}`} 
                                        step="0.01" 
                                    />
                                    <button type="button" onClick={() => removeLinkedTxn(link.id)} className="text-gray-400 hover:text-red-500 p-1 rounded"><Trash2 size={14} /></button>
                                </div>
                            );
                        })}
                        <div className={`text-xs font-medium flex justify-between ${Math.abs(allocationDiff) < 0.05 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            <span>Total Allocated: {formatCurrency(totalAllocated * 100)}</span>
                            <span>{Math.abs(allocationDiff) < 0.05 ? "✓ Matches Total" : `${formatCurrency(Math.abs(allocationDiff)*100)} ${allocationDiff > 0 ? 'Remaining' : 'Exceeded'}`}</span>
                        </div>
                    </div>
                )}
              </div>
          </div>
      )}

      {/* Standard Fields with Amount Edit Logic */}
      <Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={handleAmountChange} required className="col-span-1" />
      <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="col-span-1" />
      <Select label="Category" value={category} onChange={e => handleQuickAddRequest(e.target.value, 'categories', 'Category')} options={mapOptions(categories, 'categories', 'Category')} className="col-span-1" />
      <Select label="Place" value={place} onChange={e => handleQuickAddRequest(e.target.value, 'places', 'Place')} options={mapOptions(places, 'places', 'Place')} className="col-span-1" />
      <Select label="Tag" value={tag} onChange={e => handleQuickAddRequest(e.target.value, 'tags', 'Tag')} options={mapOptions(tags, 'tags', 'Tag')} className="col-span-1" />
      <Select label="Mode" value={mode} onChange={e => handleQuickAddRequest(e.target.value, 'modesOfPayment', 'Mode')} options={mapOptions(modesOfPayment, 'modesOfPayment', 'Mode')} className="col-span-1" />
      <Input label="Description (Optional)" value={description} onChange={e => setDescription(e.target.value)} className="col-span-1 md:col-span-2 lg:col-span-2" placeholder="Short notes..." />

      {/* Split Options (Hidden for Settlement/Income) */}
      {(type === 'expense' || isProductRefund) && (
         <div className="col-span-1 md:col-span-2 lg:col-span-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-6">
             <div className="flex items-center">
                <input type="checkbox" id="includeMe" checked={includeMe} onChange={e => setIncludeMe(e.target.checked)} className="h-5 w-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500" />
                <label htmlFor="includeMe" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include <strong>Me</strong> in this split?</label>
            </div>
            
            {showIncludePayerCheckbox && (
                 <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg px-3 py-1 dark:bg-sky-900 dark:border-sky-700">
                    <input type="checkbox" id="includePayer" checked={includePayer} onChange={e => setIncludePayer(e.target.checked)} className="h-5 w-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500" />
                    <label htmlFor="includePayer" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include Payer in split?</label>
                </div>
            )}
         </div>
      )}

      {!isIncome && !isSettlement && (
         <>
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4 border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-200 dark:border-gray-700">
                <ParticipantSelector selectedIds={selectedParticipants} onAdd={uid => setSelectedParticipants([...selectedParticipants, uid])} onRemove={uid => setSelectedParticipants(selectedParticipants.filter(x => x !== uid))} />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4">
               <Select label="Split Method" value={splitMethod} onChange={(e) => setSplitMethod(e.target.value)} options={[{ value: 'equal', label: '1. Equal Split' }, { value: 'percentage', label: '2. Percentage Split' }, { value: 'dynamic', label: '3. Dynamic (Manual) Split' }]} />
               <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                   <SplitAllocator method={splitMethod} participants={splitAllocatorParticipants} totalAmount={Math.round(parseFloat(amount || 0) * 100)} splits={splits} onSplitChange={setSplits} />
                   {validation.message && (
                      <div className={`mt-3 p-2 rounded text-sm font-medium flex items-center gap-2 ${validation.isValid ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
                          <span>{validation.isValid ? '✓' : '⚠️'}</span>{validation.message.replace(/^✓ /, '')}
                      </div>
                   )}
               </div>
            </div>
         </>
      )}

      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
         {!isEditMode && <Button type="button" variant="secondary" onClick={handleTemplateSaveRequest} className="flex-1 py-3">Save as Template</Button>}
         {isEditMode && <Button type="button" variant="secondary" onClick={handleCancel} className="flex-1 py-3">Cancel</Button>}
         <Button type="submit" className={`flex-1 sm:grow-2 py-3 text-lg shadow-md ${isEditMode ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-sky-600 hover:bg-sky-700'}`}>
            {isEditMode ? 'Update Transaction' : 'Log Transaction'}
         </Button>
      </div>
    </form>
    <ConfirmModal isOpen={showDupeModal} title="Possible Duplicate" message={`Found similar transaction: <strong>${dupeTxn?.expenseName}</strong> (${dupeTxn?.amount/100}). Add anyway?`} confirmText="Add Anyway" onConfirm={forceSubmit} onCancel={() => setShowDupeModal(false)} />
    <PromptModal isOpen={!!activePrompt} title={activePrompt?.title || ''} label={activePrompt?.label || ''} onConfirm={handlePromptConfirm} onCancel={() => setActivePrompt(null)} confirmText="Save" />
    </>
  );
};

export default TransactionForm;