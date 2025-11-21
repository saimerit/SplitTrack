import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp, addDoc, collection } from 'firebase/firestore'; // Added imports
import { db } from '../../config/firebase'; // Added db
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

  // --- NEW: Template Saving Logic ---
  const handleSaveTemplate = async () => {
    const templateName = prompt("Enter Template Name (e.g., 'Monthly Rent'):");
    if (!templateName) return;

    const amountInRupees = parseFloat(amount);
    // Allow saving template even with partial data (null amount)
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
  // ----------------------------------

  const saveTransaction = async () => {
       const amountInPaise = Math.round(parseFloat(amount) * 100);
       const multiplier = type === 'refund' ? -1 : 1;
       const finalAmount = amountInPaise * multiplier;
       
       const txnData = {
         expenseName: name,
         amount: finalAmount,
         type,
         category, place, tag, modeOfPayment: mode, description,
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

  const mapOptions = (items) => [{ value: "", label: "-- Select --" }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <>
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      <div className="grid grid-cols-3 gap-4">
        {['expense', 'income', 'refund'].map(t => (
          <label key={t} className={`cursor-pointer border rounded-lg py-2 text-center capitalize ${type === t ? 'bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-900 dark:text-sky-300' : 'border-gray-300 dark:border-gray-600'}`}>
            <input type="radio" className="sr-only" checked={type === t} onChange={() => setType(t)} />
            {t}
          </label>
        ))}
      </div>

      {type === 'refund' && (
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
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Auto-fills participants from original expense.</p>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Name" value={name} onChange={e => setName(e.target.value)} required />
        <Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
        <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
        <Select label="Category" value={category} onChange={e => setCategory(e.target.value)} options={mapOptions(categories)} />
        <Select label="Place" value={place} onChange={e => setPlace(e.target.value)} options={mapOptions(places)} />
        <Select label="Tag" value={tag} onChange={e => setTag(e.target.value)} options={mapOptions(tags)} />
        <Select label="Mode" value={mode} onChange={e => setMode(e.target.value)} options={mapOptions(modesOfPayment)} />
      </div>
      
      <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />

      {type === 'expense' && (
         <div className="flex items-center gap-2">
           <input type="checkbox" id="isReturn" checked={isReturn} onChange={e => setIsReturn(e.target.checked)} className="h-4 w-4 text-sky-600 rounded" />
           <label htmlFor="isReturn" className="text-sm text-gray-700 dark:text-gray-300">Is this a repayment?</label>
         </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         {type !== 'income' && (
            <Select 
               label={isReturn ? "Who is paying?" : "Who paid?"} 
               value={payer} onChange={e => setPayer(e.target.value)} 
               options={[{ value: "me", label: "You (me)" }, ...participants.map(p => ({ value: p.uniqueId, label: p.name }))]} 
            />
         )}
         {isReturn && (
             <Select 
               label="Who is being repaid?" 
               value={selectedParticipants[0] || ''} 
               onChange={e => setSelectedParticipants([e.target.value])} 
               options={[{ value: "me", label: "You (me)" }, ...participants.map(p => ({ value: p.uniqueId, label: p.name }))]} 
             />
         )}
      </div>

      {type !== 'income' && !isReturn && (
         <div className="border-t pt-6 dark:border-gray-700 space-y-6">
            <ParticipantSelector 
               selectedIds={selectedParticipants} 
               onAdd={uid => setSelectedParticipants([...selectedParticipants, uid])} 
               onRemove={uid => setSelectedParticipants(selectedParticipants.filter(x => x !== uid))} 
            />
            
            <div>
               <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Split Method</label>
               <div className="flex gap-4 mb-4">
                  {['equal', 'percentage', 'dynamic'].map(m => (
                     <label key={m} className="flex items-center gap-2 capitalize cursor-pointer text-sm text-gray-600 dark:text-gray-400">
                        <input type="radio" checked={splitMethod === m} onChange={() => setSplitMethod(m)} className="text-sky-600" /> {m}
                     </label>
                  ))}
               </div>
               <SplitAllocator 
                  method={splitMethod}
                  participants={[{ uniqueId: 'me', name: 'You' }, ...participants.filter(p => selectedParticipants.includes(p.uniqueId))]}
                  totalAmount={Math.round(parseFloat(amount || 0) * 100)}
                  splits={splits}
                  onSplitChange={setSplits}
               />
               {splitError && (
                  <p className="text-sm text-red-600 mt-1">{splitError}</p>
               )}
            </div>
         </div>
      )}

      <div className="flex gap-4 pt-4">
         <Button type="submit" className="flex-1">{isEditMode ? 'Update' : 'Log Transaction'}</Button>
         {/* CONNECTED SAVE TEMPLATE */}
         {!isEditMode && (
            <Button type="button" variant="secondary" onClick={handleSaveTemplate}>
              Save Template
            </Button>
         )}
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