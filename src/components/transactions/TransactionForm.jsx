import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp, addDoc, collection } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import useAppStore from '../../store/useAppStore';
import { addTransaction, updateTransaction } from '../../services/transactionService';
import { validateSplits } from '../../utils/validators';

import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import SplitAllocator from './SplitAllocator';
import ParticipantSelector from './ParticipantSelector';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
  const navigate = useNavigate();
  const { 
    categories, places, tags, modesOfPayment, participants, transactions,
    userSettings, showToast 
  } = useAppStore();
  
  // --- INITIALIZATION LOGIC ---
  const wasMeIncluded = initialData?.splits ? (initialData.splits['me'] !== undefined) : true;

  // State
  const [type, setType] = useState(initialData?.type || 'expense');
  const [name, setName] = useState(initialData?.expenseName || '');
  const [amount, setAmount] = useState(initialData ? (Math.abs(initialData.amount)/100).toFixed(2) : '');
  
  const getInitialDate = () => {
      try {
          if (initialData?.timestamp) {
              let d;
              if (typeof initialData.timestamp.toDate === 'function') {
                  d = initialData.timestamp.toDate();
              } else if (initialData.timestamp.seconds) {
                  d = new Date(initialData.timestamp.seconds * 1000);
              } else {
                  d = new Date(initialData.timestamp);
              }
              if (!isNaN(d.getTime())) {
                  return d.toISOString().split('T')[0];
              }
          }
      } catch (e) {
          console.warn("Date parsing error:", e);
      }
      return new Date().toISOString().split('T')[0];
  };

  const [date, setDate] = useState(getInitialDate());
  
  const [category, setCategory] = useState(initialData?.category || userSettings.defaultCategory || '');
  const [place, setPlace] = useState(initialData?.place || userSettings.defaultPlace || '');
  const [tag, setTag] = useState(initialData?.tag || userSettings.defaultTag || '');
  const [mode, setMode] = useState(initialData?.modeOfPayment || userSettings.defaultMode || '');
  const [description, setDescription] = useState(initialData?.description || '');

  const [payer, setPayer] = useState(initialData?.payer || 'me');
  const [isReturn, setIsReturn] = useState(initialData?.isReturn || false);
  
  const [selectedParticipants, setSelectedParticipants] = useState(initialData?.participants || []);
  
  const [refundParentId, setRefundParentId] = useState(initialData?.parentTransactionId || '');
  const [splitMethod, setSplitMethod] = useState(initialData?.splitMethod || 'equal');
  const [splits, setSplits] = useState(initialData?.splits || {}); 
  
  const [includeMe, setIncludeMe] = useState(wasMeIncluded);

  const [showDupeModal, setShowDupeModal] = useState(false);
  const [dupeTxn, setDupeTxn] = useState(null);

  // --- MODAL STATE FOR PROMPTS ---
  const [activePrompt, setActivePrompt] = useState(null); 

  const eligibleParents = transactions
    .filter(t => t.amount > 0 && !t.isReturn)
    .sort((a, b) => b.timestamp - a.timestamp);

  const isIncome = type === 'income';

  // Filter participants for the split allocator
  const splitAllocatorParticipants = [
      ...(includeMe ? [{ uniqueId: 'me', name: 'You' }] : []),
      ...participants.filter(p => selectedParticipants.includes(p.uniqueId))
  ];

  // --- LIVE VALIDATION ---
  const validation = useMemo(() => {
    if (type === 'income' || isReturn) {
        return { isValid: true, message: '' };
    }

    const amountInRupees = parseFloat(amount);
    if (isNaN(amountInRupees) || amountInRupees === 0) {
        return splitMethod === 'dynamic' 
            ? { isValid: false, message: 'Enter a total amount first.' }
            : { isValid: true, message: '' };
    }

    const amountInPaise = Math.round(amountInRupees * 100);
    return validateSplits(amountInPaise, splits, splitMethod);
  }, [amount, splits, splitMethod, type, isReturn]);


  const handleRefundParentChange = (e) => {
    const pid = e.target.value;
    setRefundParentId(pid);
    const parent = transactions.find(t => t.id === pid);
    if (parent) {
       if(!name) setName("Refund: " + parent.expenseName);
       const newParts = parent.participants.filter(id => id !== 'me');
       setSelectedParticipants(newParts);
    }
  };

  const handleQuickAddRequest = (value, collectionName, label) => {
    if (value === `add_new_${collectionName}`) {
        setActivePrompt({ 
            type: 'quickAdd', 
            targetCollection: collectionName,
            targetLabel: label,
            title: `Add New ${label}`,
            label: `New ${label} Name`
        });
    } else {
        if(collectionName === 'categories') setCategory(value);
        if(collectionName === 'places') setPlace(value);
        if(collectionName === 'tags') setTag(value);
        if(collectionName === 'modesOfPayment') setMode(value);
    }
  };

  const handleTemplateSaveRequest = () => {
      setActivePrompt({
          type: 'template',
          title: 'Save as Template',
          label: 'Template Name'
      });
  };

  const handleCancel = () => {
      navigate(-1);
  };

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
          } catch (error) {
              console.error(error);
              showToast(`Failed to add ${targetLabel}.`, true);
          }
      } 
      else if (promptType === 'template') {
          await executeTemplateSave(inputValue);
      }
      
      setActivePrompt(null);
  };

  const executeTemplateSave = async (templateName) => {
    const amountInRupees = parseFloat(amount);
    const multiplier = type === 'refund' ? -1 : 1;
    const finalAmount = !isNaN(amountInRupees) ? Math.round(amountInRupees * 100) * multiplier : null;

    const templateData = {
        name: templateName,
        expenseName: name,
        amount: finalAmount,
        type,
        category, place, tag, modeOfPayment: mode, description,
        payer: (type === 'income') ? 'me' : payer,
        isReturn,
        participants: (type === 'income') ? [] : (isReturn ? [selectedParticipants[0]] : selectedParticipants),
        splitMethod: (isReturn || type === 'income') ? 'none' : splitMethod,
        splits: (isReturn || type === 'income') ? {} : splits,
    };

    try {
        await addDoc(collection(db, 'ledgers/main-ledger/templates'), templateData);
        showToast("Template saved successfully!");
    } catch (error) {
        console.error(error);
        showToast("Failed to save template.", true);
    }
  };

  const saveTransaction = async () => {
       const amountInPaise = Math.round(parseFloat(amount) * 100);
       const multiplier = type === 'refund' ? -1 : 1;
       const finalAmount = amountInPaise * multiplier;
       
       let safeParticipants = selectedParticipants;
       if (isReturn && (!selectedParticipants || selectedParticipants.length === 0)) {
           safeParticipants = ['me'];
       }

       let finalSplits = { ...splits }; 
       
       if (!isReturn && type !== 'income' && splitMethod === 'equal') {
           const involvedCount = splitAllocatorParticipants.length;
           if (involvedCount > 0) {
               const absAmount = Math.abs(amountInPaise);
               const share = Math.floor(absAmount / involvedCount);
               const remainder = absAmount % involvedCount;
               
               finalSplits = {}; 
               
               splitAllocatorParticipants.forEach((p, index) => {
                   let val = share;
                   if (index < remainder) {
                       val += 1;
                   }
                   finalSplits[p.uniqueId] = val * multiplier;
               });
           }
       }

       const txnData = {
         expenseName: name,
         amount: finalAmount,
         type,
         category: category.startsWith('add_new') ? '' : category, 
         place: place.startsWith('add_new') ? '' : place,
         tag: tag.startsWith('add_new') ? '' : tag,
         modeOfPayment: mode.startsWith('add_new') ? '' : mode,
         description,
         timestamp: Timestamp.fromDate(new Date(date)),
         payer: (type === 'income') ? 'me' : payer,
         isReturn,
         participants: (type === 'income') ? [] : (isReturn ? [safeParticipants[0]] : safeParticipants),
         splitMethod: (isReturn || type === 'income') ? 'none' : splitMethod,
         splits: (isReturn || type === 'income') ? {} : finalSplits,
         parentTransactionId: refundParentId || null,
         isLinkedRefund: !!refundParentId
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
       } catch(e) { 
         console.error(e); 
         showToast("Error saving: " + e.message, true); 
       }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const amountInRupees = parseFloat(amount);
    if (!name || !amountInRupees || amountInRupees <= 0) {
        showToast("Please enter valid name and amount", true);
        return;
    }

    if (!isReturn && !isIncome && !validation.isValid) {
        showToast(validation.message || "Please fix split errors.", true);
        return;
    }

    if (!isEditMode) {
        const checkAmount = Math.round(amountInRupees * 100);
        const potentialDupe = transactions.find(t => 
            Math.abs(t.amount) === checkAmount &&
            t.expenseName.toLowerCase().trim() === name.toLowerCase().trim() &&
            t.timestamp.toDate().toISOString().split('T')[0] === date
        );
        if (potentialDupe) {
            setDupeTxn(potentialDupe);
            setShowDupeModal(true);
            return;
        }
    }
    saveTransaction();
  };

  const forceSubmit = async () => {
      setShowDupeModal(false);
      saveTransaction();
  };

  const mapOptions = (items, collectionName, label) => [
      { value: "", label: "-- Select --" }, 
      ...items.map(i => ({ value: i.name, label: i.name })),
      { value: `add_new_${collectionName}`, label: `+ Add New ${label}`, className: "text-sky-600 font-bold bg-sky-50" }
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
              <input 
                type="radio" 
                name="txnType" 
                value={t} 
                checked={type === t} 
                onChange={() => setType(t)} 
                className="peer sr-only" 
              />
              <div className={`
                text-center py-3 rounded-lg border transition-all font-medium capitalize
                ${type === t 
                  ? (t === 'expense' ? 'bg-red-50 text-red-700 border-red-500 dark:bg-red-900/20 dark:text-red-400' : 
                     t === 'income' ? 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-900/20 dark:text-blue-400' : 
                     'bg-green-50 text-green-700 border-green-500 dark:bg-green-900/20 dark:text-green-400')
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}
              `}>
                {t === 'expense' ? 'Expense (Out)' : t === 'income' ? 'Income (In)' : 'Refund (Return)'}
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* 2. Name */}
      <Input 
        label="Expense Name" 
        value={name} 
        onChange={e => setName(e.target.value)} 
        required 
        className="col-span-1 md:col-span-2 lg:col-span-4" 
        placeholder="e.g. Dinner at Taj"
      />

      {/* 3. Refund Parent */}
      {type === 'refund' && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                <Select 
                    label="Link to Original Expense (Optional)" 
                    value={refundParentId} 
                    onChange={handleRefundParentChange} 
                    options={[
                        { value: '', label: '-- Select Expense --' },
                        ...eligibleParents.map(t => ({ value: t.id, label: `${t.expenseName} (${(t.amount/100).toFixed(2)})` }))
                    ]} 
                />
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">Selecting an expense will auto-fill participants.</p>
              </div>
          </div>
      )}

      {/* 4. Core Fields */}
      <Input 
        label="Amount (₹)" 
        type="number" 
        step="0.01" 
        value={amount} 
        onChange={e => setAmount(e.target.value)} 
        required 
        className="col-span-1" 
      />
      <Input 
        label="Date" 
        type="date" 
        value={date} 
        onChange={e => setDate(e.target.value)} 
        required 
        className="col-span-1" 
      />
      <Select 
        label="Category" 
        value={category} 
        onChange={e => handleQuickAddRequest(e.target.value, 'categories', 'Category')} 
        options={mapOptions(categories, 'categories', 'Category')} 
        className="col-span-1"
      />
      <Select 
        label="Place" 
        value={place} 
        onChange={e => handleQuickAddRequest(e.target.value, 'places', 'Place')} 
        options={mapOptions(places, 'places', 'Place')} 
        className="col-span-1"
      />
      <Select 
        label="Tag" 
        value={tag} 
        onChange={e => handleQuickAddRequest(e.target.value, 'tags', 'Tag')} 
        options={mapOptions(tags, 'tags', 'Tag')} 
        className="col-span-1"
      />
      <Select 
        label="Mode" 
        value={mode} 
        onChange={e => handleQuickAddRequest(e.target.value, 'modesOfPayment', 'Mode')} 
        options={mapOptions(modesOfPayment, 'modesOfPayment', 'Mode')} 
        className="col-span-1"
      />
      <Input 
        label="Description (Optional)" 
        value={description} 
        onChange={e => setDescription(e.target.value)} 
        className="col-span-1 md:col-span-2 lg:col-span-2" 
        placeholder="Short notes..."
      />

      {/* 6. Options (Return & Include Me) */}
      {type === 'expense' && (
         <div className="col-span-1 md:col-span-2 lg:col-span-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-6">
           <div className="flex items-center">
             <input 
                type="checkbox" 
                id="isReturn" 
                checked={isReturn} 
                onChange={e => setIsReturn(e.target.checked)} 
                className="h-5 w-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600" 
             />
             <label htmlFor="isReturn" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                Is this a return transaction? (Repayment)
             </label>
           </div>

           {!isReturn && (
             <div className="flex items-center">
                <input 
                    type="checkbox" 
                    id="includeMe" 
                    checked={includeMe} 
                    onChange={e => setIncludeMe(e.target.checked)}
                    className="h-5 w-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600"
                />
                <label htmlFor="includeMe" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
                    Include <strong>Me</strong> in this split?
                </label>
            </div>
           )}
         </div>
      )}

      {/* 7. Payer */}
      <div className="col-span-1 md:col-span-1 lg:col-span-2">
         {type !== 'income' && (
            <Select 
               label={isReturn ? "Who is paying/returning?" : "Who paid?"} 
               value={payer} onChange={e => setPayer(e.target.value)} 
               options={[{ value: "me", label: "You (me)" }, ...participants.map(p => ({ value: p.uniqueId, label: p.name }))]} 
            />
         )}
      </div>
      
      {isReturn && (
         <div className="col-span-1 md:col-span-1 lg:col-span-2">
             <Select 
               label="Who is being repaid?" 
               value={selectedParticipants[0] || ''} 
               onChange={e => setSelectedParticipants([e.target.value])} 
               options={[{ value: "me", label: "You (me)" }, ...participants.map(p => ({ value: p.uniqueId, label: p.name }))]} 
             />
         </div>
      )}

      {/* 8. Participants & Splits */}
      {type !== 'income' && !isReturn && (
         <>
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4 border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-200 dark:border-gray-700">
                <ParticipantSelector 
                   selectedIds={selectedParticipants} 
                   onAdd={uid => setSelectedParticipants([...selectedParticipants, uid])} 
                   onRemove={uid => setSelectedParticipants(selectedParticipants.filter(x => x !== uid))} 
                />
            </div>
            
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4">
               <Select 
                  label="Split Method"
                  value={splitMethod}
                  onChange={(e) => setSplitMethod(e.target.value)}
                  options={[
                      { value: 'equal', label: '1. Equal Split' },
                      { value: 'percentage', label: '2. Percentage Split' },
                      { value: 'dynamic', label: '3. Dynamic (Manual) Split' }
                  ]}
               />
               
               <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                   <SplitAllocator 
                      method={splitMethod}
                      participants={splitAllocatorParticipants}
                      totalAmount={Math.round(parseFloat(amount || 0) * 100)}
                      splits={splits}
                      onSplitChange={setSplits}
                   />
                   
                   {/* Live Validation Feedback */}
                   {validation.message && (
                      <div className={`mt-3 p-2 rounded text-sm font-medium flex items-center gap-2 ${
                          validation.isValid 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                      }`}>
                          <span>{validation.isValid ? '✓' : '⚠️'}</span>
                          {validation.message.replace(/^✓ /, '')}
                      </div>
                   )}
               </div>
            </div>
         </>
      )}

      {/* 9. Buttons */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
         {!isEditMode && (
            <Button type="button" variant="secondary" onClick={handleTemplateSaveRequest} className="flex-1 py-3">
              Save as Template
            </Button>
         )}
         {/* Cancel Button for Edit Mode */}
         {isEditMode && (
             <Button type="button" variant="secondary" onClick={handleCancel} className="flex-1 py-3">
                 Cancel
             </Button>
         )}
         <Button 
            type="submit" 
            className={`flex-1 sm:grow-2 py-3 text-lg shadow-md ${
                isEditMode 
                    ? 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-500' 
                    : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-500'
            }`}
         >
            {isEditMode ? 'Update Transaction' : 'Log Transaction'}
         </Button>
      </div>
    </form>

    {/* Duplicate Warning Modal */}
    <ConfirmModal 
       isOpen={showDupeModal} 
       title="Possible Duplicate" 
       message={`Found similar transaction: <strong>${dupeTxn?.expenseName}</strong> (${dupeTxn?.amount/100}). Add anyway?`}
       confirmText="Add Anyway"
       onConfirm={forceSubmit}
       onCancel={() => setShowDupeModal(false)}
    />

    {/* Universal Prompt Modal for Quick Adds & Templates */}
    <PromptModal
        isOpen={!!activePrompt}
        title={activePrompt?.title || ''}
        label={activePrompt?.label || ''}
        onConfirm={handlePromptConfirm}
        onCancel={() => setActivePrompt(null)}
        confirmText="Save"
    />
    </>
  );
};

export default TransactionForm;