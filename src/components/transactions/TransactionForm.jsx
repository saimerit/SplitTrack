import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Navigation
import { Timestamp } from 'firebase/firestore';
import useAppStore from '../../store/useAppStore';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { addTransaction, updateTransaction } from '../../services/transactionService';
import { validateSplits } from '../../utils/validators';

// UI Components
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import SplitAllocator from './SplitAllocator';
import ParticipantSelector from './ParticipantSelector';

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
  const navigate = useNavigate();
  const { 
    categories, places, tags, modesOfPayment, participants, 
    userSettings, showToast 
  } = useAppStore();
  
  const { addToQueue } = useOfflineQueue();

  // --- Form State ---
  const [type, setType] = useState(initialData?.type || 'expense');
  const [name, setName] = useState(initialData?.expenseName || '');
  const [amount, setAmount] = useState(initialData ? (Math.abs(initialData.amount)/100).toFixed(2) : '');
  const [date, setDate] = useState(initialData?.timestamp ? new Date(initialData.timestamp.toDate()).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
  
  const [category, setCategory] = useState(initialData?.category || userSettings.defaultCategory || '');
  const [place, setPlace] = useState(initialData?.place || userSettings.defaultPlace || '');
  const [tag, setTag] = useState(initialData?.tag || userSettings.defaultTag || '');
  const [mode, setMode] = useState(initialData?.modeOfPayment || userSettings.defaultMode || '');
  const [description, setDescription] = useState(initialData?.description || '');

  // Payer / Participants / Splits
  const [payer, setPayer] = useState(initialData?.payer || 'me');
  const [isReturn, setIsReturn] = useState(initialData?.isReturn || false);
  const [selectedParticipants, setSelectedParticipants] = useState(initialData?.participants || []);
  
  const [splitMethod, setSplitMethod] = useState(initialData?.splitMethod || 'equal');
  // We store absolute Paise values for dynamic splits, or raw percentages
  const [splits, setSplits] = useState(initialData?.splits || {}); 
  const [splitError, setSplitError] = useState('');

  // --- Derived State ---
  const isIncome = type === 'income';
  const isRefund = type === 'refund';

  // --- Handlers ---

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSplitError('');

    const amountInRupees = parseFloat(amount);
    if (!name || !amountInRupees || amountInRupees <= 0) {
      showToast("Please enter valid name and amount", true);
      return;
    }

    const amountInPaise = Math.round(amountInRupees * 100);
    const multiplier = isRefund ? -1 : 1;
    const finalAmount = amountInPaise * multiplier;

    // Validation
    if (!isReturn && !isIncome) {
      const validation = validateSplits(amountInPaise, splits, splitMethod);
      if (!validation.isValid) {
        setSplitError(validation.message);
        return;
      }
    }

    const txnData = {
      expenseName: name,
      amount: finalAmount,
      type,
      category,
      place,
      tag,
      modeOfPayment: mode,
      description,
      timestamp: Timestamp.fromDate(new Date(date)),
      payer,
      isReturn,
      // Income/Return logic overrides participants
      participants: isIncome ? [] : (isReturn ? [selectedParticipants[0]] : selectedParticipants),
      splitMethod: (isReturn || isIncome) ? 'none' : splitMethod,
      splits: (isReturn || isIncome) ? {} : splits,
      // Preserve parent ID if editing a refund
      parentTransactionId: initialData?.parentTransactionId || null
    };

    try {
      if (!navigator.onLine) {
        addToQueue(txnData); // Save offline
        navigate('/'); // Go back to dashboard
        return;
      }

      if (isEditMode) {
        await updateTransaction(initialData.id, txnData, initialData.parentTransactionId);
        showToast("Transaction updated!");
      } else {
        await addTransaction(txnData);
        showToast("Transaction added!");
      }
      navigate('/'); // Go back to dashboard
    } catch (error) {
      console.error(error);
      showToast("Failed to save transaction", true);
    }
  };

  // --- Render Options Helpers ---
  const mapOptions = (items) => [
    { value: "", label: "-- Select --" },
    ...items.map(i => ({ value: i.name, label: i.name })),
    { value: "add_new", label: "+ Add New", className: "font-bold text-sky-600" }
  ];

  const payerOptions = [
    { value: "me", label: "You (me)" },
    ...participants.map(p => ({ value: p.uniqueId, label: p.name }))
  ];

  return (
    <form onSubmit={handleSubmit} className="max-w-4xl mx-auto space-y-6 bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
      
      {/* 1. Type Selection */}
      <div className="grid grid-cols-3 gap-4">
        {['expense', 'income', 'refund'].map(t => (
          <label key={t} className={`cursor-pointer border rounded-lg py-2 text-center capitalize ${type === t ? 'bg-sky-100 border-sky-500 text-sky-700 dark:bg-sky-900 dark:text-sky-300' : 'border-gray-300 dark:border-gray-600'}`}>
            <input type="radio" className="sr-only" checked={type === t} onChange={() => setType(t)} />
            {t}
          </label>
        ))}
      </div>

      {/* 2. Basic Fields */}
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

      {/* 3. Checkbox: Is Return? */}
      {!isIncome && (
        <div className="flex items-center gap-2">
          <input type="checkbox" id="isReturn" checked={isReturn} onChange={e => setIsReturn(e.target.checked)} className="h-4 w-4 text-sky-600 rounded" />
          <label htmlFor="isReturn" className="text-sm text-gray-700 dark:text-gray-300">Is this a repayment?</label>
        </div>
      )}

      {/* 4. Payer Logic */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select label={isReturn ? "Who is paying?" : "Who paid?"} value={payer} onChange={e => setPayer(e.target.value)} options={payerOptions} />
        
        {isReturn && (
          <Select 
            label="Who is being repaid?" 
            value={selectedParticipants[0] || ''} 
            onChange={e => setSelectedParticipants([e.target.value])} 
            options={payerOptions} 
          />
        )}
      </div>

      {/* 5. Participants & Splits (Hidden for Income/Returns) */}
      {!isReturn && !isIncome && (
        <div className="space-y-6 border-t pt-6 dark:border-gray-700">
          <ParticipantSelector 
            selectedIds={selectedParticipants}
            onAdd={uid => setSelectedParticipants([...selectedParticipants, uid])}
            onRemove={uid => setSelectedParticipants(selectedParticipants.filter(id => id !== uid))}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Split Method</label>
            <div className="flex gap-4 mb-4">
              {['equal', 'percentage', 'dynamic'].map(m => (
                <label key={m} className="flex items-center gap-2 capitalize cursor-pointer text-sm">
                  <input type="radio" checked={splitMethod === m} onChange={() => setSplitMethod(m)} className="text-sky-600" />
                  {m}
                </label>
              ))}
            </div>

            {/* The SplitAllocator we created earlier */}
            <SplitAllocator 
              method={splitMethod}
              participants={[
                // We need to include 'me' + selected participants in the split list
                { uniqueId: 'me', name: 'You' },
                ...participants.filter(p => selectedParticipants.includes(p.uniqueId))
              ]}
              totalAmount={Math.round(parseFloat(amount || 0) * 100)}
              splits={splits}
              onSplitChange={setSplits}
            />
            
            {splitError && (
              <div className="p-2 mt-2 text-sm bg-red-100 text-red-700 rounded">
                {splitError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Actions */}
      <div className="flex gap-4 pt-4">
        <Button type="submit" className="flex-1">
          {isEditMode ? 'Update Transaction' : 'Log Transaction'}
        </Button>
        {!isEditMode && (
          <Button type="button" variant="secondary" onClick={() => {/* Add Save Template Logic later */}}>
            Save Template
          </Button>
        )}
      </div>
    </form>
  );
};

export default TransactionForm;