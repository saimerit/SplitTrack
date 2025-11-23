import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp, addDoc, collection } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import useAppStore from '../../store/useAppStore';
import { addTransaction, updateTransaction } from '../../services/transactionService';
import { validateSplits } from '../../utils/validators';
import { formatCurrency } from '../../utils/formatters';
import { Trash2, RefreshCw, HandCoins } from 'lucide-react';

import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import SplitAllocator from './SplitAllocator';
import ParticipantSelector from './ParticipantSelector';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';

// --- HELPERS MOVED OUTSIDE TO AVOID LINTER DEPENDENCY ISSUES ---

// Helper: Get readable date string from transaction
const getTxnDateStr = (txn) => {
    if (!txn?.timestamp) return '';
    const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper: Calculates the name string based on links and type
const generateSmartName = (links, subTypeStr) => {
    if (!links || links.length === 0) return "";
    
    // Determine prefix based on the subType passed in
    const prefix = (subTypeStr === 'settlement') ? "Repayment" : "Refund";
    
    return `${prefix}: ` + links.map(t => 
        `${t.name} bought on ${t.dateStr}`
    ).join(', ');
};

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
  const navigate = useNavigate();
  const { 
    categories, places, tags, modesOfPayment, participants, transactions,
    userSettings, showToast 
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

  // Derived booleans for cleaner logic
  const isRefundTab = type === 'refund';
  const isSettlement = isRefundTab && refundSubType === 'settlement'; // Peer-to-Peer
  const isProductRefund = isRefundTab && refundSubType === 'product'; // Vendor-to-Person
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
  
  // Multi-Link State
  const [linkedTxns, setLinkedTxns] = useState([]); 
  const [tempSelectId, setTempSelectId] = useState(''); 
  const hasInitializedLinks = useRef(false);
  
  const [splitMethod, setSplitMethod] = useState(initialData?.splitMethod || 'equal');
  const [splits, setSplits] = useState(initialData?.splits || {}); 
  const [includeMe, setIncludeMe] = useState(wasMeIncluded);

  const [showDupeModal, setShowDupeModal] = useState(false);
  const [dupeTxn, setDupeTxn] = useState(null);
  const [activePrompt, setActivePrompt] = useState(null); 

  // Updates state if the user hasn't entered a custom name
  const updateSmartName = (newLinks, newSubType) => {
      const smartName = generateSmartName(newLinks, newSubType);
      if (!smartName) return;

      // Check if current name is empty OR starts with a standard prefix (not custom)
      // Use the current state 'name' directly here since this runs on user interaction
      if (!name || name.startsWith("Refund:") || name.startsWith("Repayment:")) {
          setName(smartName);
      }
  };

  // Reset initialization ref when the edited transaction changes
  useEffect(() => {
      hasInitializedLinks.current = false;
  }, [initialData?.id]);

  // Populate initial linked transactions safely
  useEffect(() => {
      if (hasInitializedLinks.current || transactions.length === 0) return;

      let linksToSet = [];
      let shouldUpdate = false;

      if (initialData && initialData.linkedTransactions) {
          linksToSet = initialData.linkedTransactions.map(link => {
              const original = transactions.find(t => t.id === link.id);
              return {
                  id: link.id,
                  name: original ? original.expenseName : 'Unknown',
                  dateStr: getTxnDateStr(original),
                  fullAmount: original ? Math.abs(original.amount) : 0,
                  allocated: (Math.abs(link.amount) / 100).toFixed(2)
              };
          });
          shouldUpdate = true;
      } else if (initialData && initialData.parentTransactionId) {
          const original = transactions.find(t => t.id === initialData.parentTransactionId);
          if (original) {
              linksToSet = [{
                  id: original.id,
                  name: original.expenseName,
                  dateStr: getTxnDateStr(original),
                  fullAmount: Math.abs(original.amount),
                  allocated: (Math.abs(initialData.amount) / 100).toFixed(2)
              }];
              shouldUpdate = true;
          }
      }

      if (shouldUpdate) {
          setTimeout(() => {
              setLinkedTxns(linksToSet);
              
              // Logic to set initial name if missing
              // Check initialData directly instead of calling getInitialSubType() to avoid dependency
              const currentSubType = initialData?.isReturn ? 'settlement' : 'product';
              
              const smartName = generateSmartName(linksToSet, currentSubType);
              if (!initialData?.expenseName) {
                  setName(smartName);
              }
              hasInitializedLinks.current = true;
          }, 0);
      }
  }, [initialData, transactions]);

  // Filter for eligible parents
  const eligibleParents = transactions
    .filter(t => t.amount > 0 && !t.isReturn)
    .filter(t => !linkedTxns.some(l => l.id === t.id))
    .sort((a, b) => b.timestamp - a.timestamp);

  const splitAllocatorParticipants = [
      ...(includeMe ? [{ uniqueId: 'me', name: 'You' }] : []),
      ...participants.filter(p => selectedParticipants.includes(p.uniqueId))
  ];

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


  // --- Multi-Link Logic ---
  const autoUpdateTotal = (currentLinks) => {
      const total = currentLinks.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0);
      if (total > 0) {
          setAmount(total.toFixed(2));
      }
  };

  const addLinkedTxn = (e) => {
      const pid = e.target.value;
      if (!pid) return;
      
      const parent = transactions.find(t => t.id === pid);
      if (parent) {
           // Only handle side-effects (participants/recipient) for the first link
           // Name generation is handled at the end
           if (linkedTxns.length === 0) {
               if(isProductRefund) {
                   const newParts = parent.participants.filter(id => id !== 'me');
                   setSelectedParticipants(newParts);
                   const meInvolved = parent.splits && parent.splits['me'] !== undefined;
                   setIncludeMe(meInvolved);
               } else if (isSettlement) {
                   // For settlements, auto-set recipient to the original payer
                   if (parent.payer !== 'me') {
                       setSelectedParticipants([parent.payer]);
                   }
               }
           }

           const currentTotal = parseFloat(amount) || 0;
           const currentAllocated = linkedTxns.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0);
           const remaining = Math.max(0, currentTotal - currentAllocated);
           const parentAmount = Math.abs(parent.amount) / 100;
           const defaultAlloc = remaining > 0 ? Math.min(remaining, parentAmount) : parentAmount;

           const newLink = {
               id: parent.id,
               name: parent.expenseName,
               dateStr: getTxnDateStr(parent),
               fullAmount: Math.abs(parent.amount),
               allocated: defaultAlloc.toFixed(2)
           };
           
           const updatedLinks = [...linkedTxns, newLink];
           setLinkedTxns(updatedLinks);
           autoUpdateTotal(updatedLinks);
           
           // UPDATE NAME HERE
           updateSmartName(updatedLinks, refundSubType);
      }
      setTempSelectId('');
  };

  const removeLinkedTxn = (id) => {
      const updatedLinks = linkedTxns.filter(t => t.id !== id);
      setLinkedTxns(updatedLinks);
      autoUpdateTotal(updatedLinks); 
      
      // UPDATE NAME HERE
      updateSmartName(updatedLinks, refundSubType);
  };

  const updateLinkedAllocation = (id, val) => {
      const updatedLinks = linkedTxns.map(t => 
          t.id === id ? { ...t, allocated: val } : t
      );
      setLinkedTxns(updatedLinks);
      autoUpdateTotal(updatedLinks);
      // Name doesn't change on allocation update, so no call needed here
  };

  // --- SubType Toggle Handlers ---
  const handleSubTypeChange = (newType) => {
      setRefundSubType(newType);
      // Trigger name update immediately with the NEW type
      updateSmartName(linkedTxns, newType);
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

  const handlePromptConfirm = async (inputValue) => {
      if (!inputValue) return;
      const { type: promptType, targetCollection, targetLabel } = activePrompt;
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

  const saveTransaction = async () => {
       const amountInPaise = Math.round(parseFloat(amount) * 100);
       
       const multiplier = isProductRefund ? -1 : 1;
       const finalAmount = amountInPaise * multiplier;
       
       let safeParticipants = selectedParticipants;
       if (isSettlement && (!selectedParticipants || selectedParticipants.length === 0)) {
           safeParticipants = ['me'];
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
         type: isSettlement ? 'expense' : type, // IMPORTANT: Settlements are saved as 'expense'
         category: category.startsWith('add_new') ? '' : category, 
         place: place.startsWith('add_new') ? '' : place, 
         tag: tag.startsWith('add_new') ? '' : tag,
         modeOfPayment: mode.startsWith('add_new') ? '' : mode, 
         description,
         timestamp: Timestamp.fromDate(new Date(date)), 
         payer: isIncome ? 'me' : payer,
         isReturn: isSettlement, // This flag marks it as a Settlement
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
         } else {
            await addTransaction(txnData);
            showToast("Transaction added!");
         }
         navigate('/');
       } catch(e) { console.error(e); showToast("Error saving: " + e.message, true); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountInRupees = parseFloat(amount);
    if (!name || !amountInRupees || amountInRupees <= 0) {
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
        // Optional warning
    }

    if (!isEditMode) {
        const checkAmount = Math.round(amountInRupees * 100);
        const potentialDupe = transactions.find(t => {
            // FIXED: Safe date checking to prevent crashes
            if (!t.timestamp) return false;
            const tDate = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            if (isNaN(tDate.getTime())) return false;
            
            return Math.abs(t.amount) === checkAmount && 
                   t.expenseName === name &&
                   tDate.toISOString().split('T')[0] === date;
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
      
      {/* 1. Transaction Type */}
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

      {/* 1.5 REFUND SUB-TYPE TOGGLE */}
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

      {/* 2. Name */}
      <Input label="Expense Name" value={name} onChange={e => setName(e.target.value)} required className="col-span-1 md:col-span-2 lg:col-span-4" placeholder={isSettlement ? "Repayment" : "e.g. Dinner at Taj"} />

      {/* 3. MULTI-LINK SECTION (Now for both Product Refunds and Settlements) */}
      {(isProductRefund || isSettlement) && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link to Original Expense(s) (Optional)</label>
                <Select value={tempSelectId} onChange={addLinkedTxn} options={[{ value: '', label: '-- Add Expense to Link --' }, ...eligibleParents.map(t => ({ value: t.id, label: `${t.expenseName} (${formatCurrency(t.amount)})` }))]} />
                {linkedTxns.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {linkedTxns.map((link) => (
                            <div key={link.id} className="flex items-center gap-2 bg-white dark:bg-gray-800 p-2 rounded border border-blue-200 dark:border-blue-700">
                                <span className="text-sm flex-1 dark:text-gray-300 truncate" title={link.name}>{link.name} <span className="text-xs text-gray-500">({formatCurrency(link.fullAmount)})</span></span>
                                <span className="text-sm text-gray-500">Allocate: ₹</span>
                                <input type="number" value={link.allocated} onChange={(e) => updateLinkedAllocation(link.id, e.target.value)} className="w-20 px-1 py-1 text-sm border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600" min="0" step="0.01" />
                                <button type="button" onClick={() => removeLinkedTxn(link.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1 rounded"><Trash2 size={14} /></button>
                            </div>
                        ))}
                        <div className={`text-xs font-medium flex justify-between ${Math.abs(allocationDiff) < 0.05 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            <span>Total Allocated: {formatCurrency(totalAllocated * 100)}</span>
                            <span>{Math.abs(allocationDiff) < 0.05 ? "✓ Matches Total" : `${formatCurrency(Math.abs(allocationDiff)*100)} ${allocationDiff > 0 ? 'Remaining' : 'Exceeded'}`}</span>
                        </div>
                    </div>
                )}
              </div>
          </div>
      )}

      {/* 4. Core Fields */}
      <Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required className="col-span-1" />
      <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="col-span-1" />
      <Select label="Category" value={category} onChange={e => handleQuickAddRequest(e.target.value, 'categories', 'Category')} options={mapOptions(categories, 'categories', 'Category')} className="col-span-1" />
      <Select label="Place" value={place} onChange={e => handleQuickAddRequest(e.target.value, 'places', 'Place')} options={mapOptions(places, 'places', 'Place')} className="col-span-1" />
      <Select label="Tag" value={tag} onChange={e => handleQuickAddRequest(e.target.value, 'tags', 'Tag')} options={mapOptions(tags, 'tags', 'Tag')} className="col-span-1" />
      <Select label="Mode" value={mode} onChange={e => handleQuickAddRequest(e.target.value, 'modesOfPayment', 'Mode')} options={mapOptions(modesOfPayment, 'modesOfPayment', 'Mode')} className="col-span-1" />
      <Input label="Description (Optional)" value={description} onChange={e => setDescription(e.target.value)} className="col-span-1 md:col-span-2 lg:col-span-2" placeholder="Short notes..." />

      {/* 6. Options (Include Me) - Only for Expense/Product Refund */}
      {(type === 'expense' || isProductRefund) && (
         <div className="col-span-1 md:col-span-2 lg:col-span-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-6">
             <div className="flex items-center">
                <input type="checkbox" id="includeMe" checked={includeMe} onChange={e => setIncludeMe(e.target.checked)} className="h-5 w-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500" />
                <label htmlFor="includeMe" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include <strong>Me</strong> in this split?</label>
            </div>
         </div>
      )}

      {/* 7. Payer & Recipient */}
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

      {/* 8. Participants & Splits (Only for Expense or Product Refund) */}
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

      {/* 9. Buttons */}
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