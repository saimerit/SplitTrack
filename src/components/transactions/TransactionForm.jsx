import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp, addDoc, collection } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import useAppStore from '../../store/useAppStore';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { addTransaction, updateTransaction } from '../../services/transactionService';
import { validateSplits } from '../../utils/validators';

import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import SplitAllocator from './SplitAllocator';
import ParticipantSelector from './ParticipantSelector';
import ConfirmModal from '../modals/ConfirmModal';

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
  const navigate = useNavigate();
  const { 
    categories, places, tags, modesOfPayment, participants, transactions,
    userSettings, showToast 
  } = useAppStore();
  
  const { addToQueue } = useOfflineQueue();

  // State
  const [type, setType] = useState(initialData?.type || 'expense');
  const [name, setName] = useState(initialData?.expenseName || '');
  const [amount, setAmount] = useState(initialData ? (Math.abs(initialData.amount)/100).toFixed(2) : '');
  const [date, setDate] = useState(initialData?.timestamp ? new Date(initialData.timestamp.toDate()).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  
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
  const [splitError, setSplitError] = useState('');
  
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [dupeTxn, setDupeTxn] = useState(null);

  const eligibleParents = transactions
    .filter(t => t.amount > 0 && !t.isReturn)
    .sort((a, b) => b.timestamp - a.timestamp);

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

  const isIncome = type === 'income';

  // --- QUICK ADD HELPER ---
  const handleQuickAdd = async (value, collectionName, label, setter) => {
    if (value === `add_new_${collectionName}`) {
        const newItemName = prompt(`Enter New ${label} Name:`);
        if (newItemName) {
            try {
                await addDoc(collection(db, `ledgers/main-ledger/${collectionName}`), { name: newItemName });
                showToast(`${label} added!`);
                setter(newItemName); 
            } catch (error) {
                console.error(error);
                showToast(`Failed to add ${label}.`, true);
                setter(''); 
            }
        } else {
            setter(''); 
        }
    } else {
        setter(value);
    }
  };

  const handleSaveTemplate = async () => {
    const templateName = prompt("Enter Template Name (e.g., 'Monthly Rent'):");
    if (!templateName) return;

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
         participants: (type === 'income') ? [] : (isReturn ? [selectedParticipants[0]] : selectedParticipants),
         splitMethod: (isReturn || type === 'income') ? 'none' : splitMethod,
         splits: (isReturn || type === 'income') ? {} : splits,
         parentTransactionId: refundParentId || null,
         isLinkedRefund: !!refundParentId
       };

       try {
         if (!navigator.onLine) {
            addToQueue(txnData);
            navigate('/'); 
            return;
         }
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
         showToast("Error saving", true); 
       }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSplitError('');

    const amountInRupees = parseFloat(amount);
    if (!name || !amountInRupees || amountInRupees <= 0) {
        showToast("Please enter valid name and amount", true);
        return;
    }

    if (!isReturn && !isIncome) {
        const amountInPaise = Math.round(amountInRupees * 100);
        const validation = validateSplits(amountInPaise, splits, splitMethod);
        if (!validation.isValid) {
            setSplitError(validation.message);
            return;
        }
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
      
      {/* 1. Transaction Type (Full Width) */}
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

      {/* 2. Expense Name (Full Width) */}
      <Input 
        label="Expense Name" 
        value={name} 
        onChange={e => setName(e.target.value)} 
        required 
        className="col-span-1 md:col-span-2 lg:col-span-4" 
        placeholder="e.g. Dinner at Taj"
      />

      {/* 3. Refund Parent Link (Full Width - Conditional) */}
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
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    Selecting an expense will auto-fill participants.
                </p>
              </div>
          </div>
      )}

      {/* 4. Core Details (Row 3) */}
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
        onChange={e => handleQuickAdd(e.target.value, 'categories', 'Category', setCategory)} 
        options={mapOptions(categories, 'categories', 'Category')} 
        className="col-span-1"
      />
      
      <Select 
        label="Place" 
        value={place} 
        onChange={e => handleQuickAdd(e.target.value, 'places', 'Place', setPlace)} 
        options={mapOptions(places, 'places', 'Place')} 
        className="col-span-1"
      />

      {/* 5. Meta Details (Row 4) */}
      <Select 
        label="Tag" 
        value={tag} 
        onChange={e => handleQuickAdd(e.target.value, 'tags', 'Tag', setTag)} 
        options={mapOptions(tags, 'tags', 'Tag')} 
        className="col-span-1"
      />
      
      <Select 
        label="Mode" 
        value={mode} 
        onChange={e => handleQuickAdd(e.target.value, 'modesOfPayment', 'Mode', setMode)} 
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

      {/* 6. Return Checkbox (Full Width) */}
      {type === 'expense' && (
         <div className="col-span-1 md:col-span-2 lg:col-span-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
         </div>
      )}

      {/* 7. Payer & Recipient (Row 5 - Half Width each) */}
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

      {/* 8. Participants & Splits (Half Width each) */}
      {type !== 'income' && !isReturn && (
         <>
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4">
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
                      participants={[{ uniqueId: 'me', name: 'You' }, ...participants.filter(p => selectedParticipants.includes(p.uniqueId))]}
                      totalAmount={Math.round(parseFloat(amount || 0) * 100)}
                      splits={splits}
                      onSplitChange={setSplits}
                   />
                   {splitError && (
                      <p className="text-sm text-red-600 mt-2 font-medium flex items-center gap-1">
                          <span className="text-lg">⚠️</span> {splitError}
                      </p>
                   )}
               </div>
            </div>
         </>
      )}

      {/* 9. Actions (Full Width) */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
         {!isEditMode && (
            <Button type="button" variant="secondary" onClick={handleSaveTemplate} className="flex-1 py-3">
              Save as Template
            </Button>
         )}
         <Button type="submit" className="flex-2 py-3 text-lg shadow-md">
            {isEditMode ? 'Update Transaction' : 'Log Transaction'}
         </Button>
      </div>
    </form>

    <ConfirmModal 
       isOpen={showDupeModal} 
       title="Possible Duplicate" 
       message={`Found similar transaction: <strong>${dupeTxn?.expenseName}</strong> (${dupeTxn?.amount/100}). Add anyway?`}
       confirmText="Add Anyway"
       onConfirm={forceSubmit}
       onCancel={() => setShowDupeModal(false)}
    />
    </>
  );
};

export default TransactionForm;