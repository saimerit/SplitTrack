import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Filter, Sparkles, Layers, ChevronDown, ArrowRightLeft, RefreshCw, HandCoins } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { useTransactionFormLogic } from '../../hooks/useTransactionForm';

import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import SplitAllocator from './SplitAllocator';
import ParticipantSelector from './ParticipantSelector';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';
import SuccessAnimation from '../common/SuccessAnimation';

// --- INTERNAL COMPONENT: SearchableSelect ---
const SearchableSelect = ({ label, value, onChange, options, placeholder, className, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const [query, setQuery] = useState("");

    // FIX: Removed Promise.resolve().then() to ensure immediate UI updates
    useEffect(() => {
    setTimeout(() => {
        if (!value) {
            setQuery("");
        } else {
            const selected = options.find(o => o.value === value);
            if (selected) setQuery(selected.label);
        }
    }, 0);
}, [value, options]);

    const filteredOptions = useMemo(() => {
        if (!query) return options;
        const lowerQuery = query.toLowerCase();
        const selected = options.find(o => o.value === value);
        // If current query matches selected label, show all options (user is just viewing)
        if (selected && selected.label.toLowerCase() === lowerQuery) return options;
        
        return options.filter(opt => 
            opt.label.toLowerCase().includes(lowerQuery)
        );
    }, [query, options, value]);

    const handleSelect = (option) => {
        onChange({ target: { value: option.value, option: option } }); 
        setQuery(option.label);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                const selected = options.find(o => o.value === value);
                if (selected) setQuery(selected.label);
                else if (!value) setQuery('');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, value, options]);

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder || "Select..."}
                    disabled={disabled}
                    className="block w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                </div>
            </div>
            
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => (
                            <div
                                key={opt.value || idx}
                                onClick={() => handleSelect(opt)}
                                className={`px-4 py-2 cursor-pointer text-sm ${opt.className || ''} ${
                                    opt.value === value 
                                    ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-200 font-medium' 
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                            >
                                {opt.label}
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No matches found</div>
                    )}
                </div>
            )}
        </div>
    );
};

// --- MAIN COMPONENT ---
const TransactionForm = ({ initialData = null, isEditMode = false }) => {
  const navigate = useNavigate();
  
  const {
      formGroupId, setFormGroupId, type, setType, setRefundSubType, name, setName, amount,
      date, setDate, category, place, tag, mode, description, setDescription,
      payer, selectedParticipants, linkedTxns, tempSelectId,
      repaymentFilter, setRepaymentFilter, splitMethod, setSplitMethod, splits, setSplits, includeMe, setIncludeMe,
      includePayer, setIncludePayer, showDupeModal, setShowDupeModal, dupeTxn, activePrompt, setActivePrompt,
      suggestion, showSuccess,
      isRefundTab, isSettlement, isProductRefund, isIncome, allParticipants, groups,
      categories, places, tags, modesOfPayment, 
      handlePayerChange, handleRecipientChange, handleParticipantAdd, handleParticipantRemove,
      handleQuickAddRequest, handlePromptConfirm, handleTemplateSaveRequest, handleSubmit, forceSubmit,
      applySuggestion, handleManualSwap, handleLinkSelect, removeLinkedTxn, updateLinkedAllocation, handleAmountChange,
      getTxnDateStr, getName, splitAllocatorParticipants, validation, eligibleParents,
      totalAllocated, allocationDiff, setLinkedTxns, isAllocationValid
  } = useTransactionFormLogic(initialData, isEditMode);

  // --- MEMOIZED OPTIONS (UI) ---
  const generateOptions = (items, collectionName, label) => [
      { value: "", label: "-- Select --" }, 
      ...items.map(i => ({ value: i.name, label: i.name })),
      { value: `add_new_${collectionName}`, label: `+ Add New ${label}`, className: "text-sky-600 font-bold bg-sky-50 dark:bg-gray-700 dark:text-sky-400" }
  ];

  const categoryOptions = useMemo(() => generateOptions(categories, 'categories', 'Category'), [categories]);
  const placeOptions = useMemo(() => generateOptions(places, 'places', 'Place'), [places]);
  const tagOptions = useMemo(() => generateOptions(tags, 'tags', 'Tag'), [tags]);
  const modeOptions = useMemo(() => generateOptions(modesOfPayment, 'modesOfPayment', 'Mode'), [modesOfPayment]);
  
  const payerOptions = useMemo(() => [{ value: "me", label: "You (me)" }, ...allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [allParticipants]);
  const recipientOptions = useMemo(() => [{ value: "me", label: "You (me)" }, ...allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [allParticipants]);
  const debtorOptions = useMemo(() => [{ value: '', label: '-- Show All --' }, ...allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [allParticipants]);

  const linkableOptions = useMemo(() => {
    return [
        { value: '', label: '-- Select Expense to Link --' },
        ...eligibleParents.map(t => {
            if (!isSettlement) {
                const rem = t.netAmount !== undefined ? t.netAmount : t.amount;
                return {
                    value: t.id,
                    label: `${t.expenseName} (Refundable: ₹${(rem / 100).toFixed(2)}) - ${getTxnDateStr(t)}`,
                    className: 'text-gray-800 dark:text-gray-200',
                    data: t
                };
            }
            const isOwedToMe = t.relationType === 'owed_to_me';
            const sign = isOwedToMe ? '+' : '-';
            const colorClass = isOwedToMe ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium';    
            const prefix = isOwedToMe ? `[${getName(t.counterParty)} owes You] ` : `[You owe ${getName(t.counterParty)}] `;
            return {
                value: t.id,
                label: `${prefix}${t.expenseName} (${sign}₹${(t.outstanding / 100).toFixed(2)}) - ${getTxnDateStr(t)}`,
                className: colorClass,
                data: t
            };
        }),
    ];
  }, [eligibleParents, getName, getTxnDateStr, isSettlement]);

  return (
    <>
    {showSuccess && <SuccessAnimation message={isEditMode ? "Transaction Updated!" : "Transaction Logged!"} />}
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      
      {/* Space Switcher */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-sky-50 dark:bg-sky-900/10 p-3 rounded-lg border border-sky-100 dark:border-sky-900 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <Layers className="text-sky-600 dark:text-sky-400" size={20} />
              <div className="flex flex-col">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase">Space</span>
                  <select value={formGroupId} onChange={(e) => { setFormGroupId(e.target.value); setLinkedTxns([]); }} className="bg-transparent font-medium text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer">
                      <option value="personal">Personal</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
              </div>
          </div>
      </div>

      {/* Type Radios */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Type</label>
        <div className="flex flex-col sm:flex-row gap-4">
          {['expense', 'income', 'refund'].map(t => (
            <label key={t} className="flex-1 cursor-pointer group">
              <input type="radio" name="txnType" value={t} checked={type === t} onChange={() => setType(t)} className="peer sr-only" />
              <div className={`text-center py-3 rounded-lg border transition-all font-medium capitalize ${type === t ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-900 dark:border-sky-500 dark:text-sky-300' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {t === 'expense' ? 'Expense (Out)' : t === 'income' ? 'Income (In)' : 'Refund / Repayment'}
              </div>
            </label>
          ))}
        </div>
      </div>

      {isRefundTab && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex gap-4">
                  <button type="button" onClick={() => setRefundSubType('product')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm border ${!isSettlement ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                      <RefreshCw size={16} /> Product Refund
                  </button>
                  <button type="button" onClick={() => setRefundSubType('settlement')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm border ${isSettlement ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                      <HandCoins size={16} /> Peer Settlement
                  </button>
              </div>
          </div>
      )}

      {/* Name Input */}
      <div className="col-span-1 md:col-span-2 lg:col-span-4 relative">
        <Input label="Expense Name" value={name} onChange={e => setName(e.target.value)} required />
        {suggestion && (
            <div onClick={applySuggestion} className="absolute z-10 top-[70px] left-0 right-0 bg-indigo-50 dark:bg-indigo-900 border border-indigo-200 p-3 rounded shadow cursor-pointer">
                <Sparkles size={18} className="inline mr-2 text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Suggestion found:</span> <span className="text-sm text-gray-600 dark:text-gray-400">{suggestion.category} • {suggestion.place}</span>
            </div>
        )}
      </div>

      {/* Payer Select */}
      <div className="col-span-1 lg:col-span-2">
         {!isIncome && <SearchableSelect label="Payer" value={payer} onChange={e => handlePayerChange(e.target.value)} options={payerOptions} placeholder="Search payer..." />}
      </div>
      
      {/* Recipient Select (Settlement) */}
      {isSettlement && (
         <div className="col-span-1 lg:col-span-2 flex items-end gap-2">
             <div className="flex-1">
                <SearchableSelect label="Recipient" value={selectedParticipants[0] || ''} onChange={e => handleRecipientChange(e.target.value)} options={recipientOptions} placeholder="Search recipient..." />
             </div>
             <button type="button" onClick={handleManualSwap} className="p-3 mb-px bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-200 transition-colors">
                 <ArrowRightLeft size={18} className="text-gray-600 dark:text-gray-300" />
             </button>
         </div>
      )}

      {/* Linking Section */}
      {(isProductRefund || isSettlement) && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-100 dark:border-blue-800">
             {isSettlement && (
                <div className="mb-4">
                    <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1 flex items-center gap-2"><Filter size={12} /> Filter by Debtor</label>
                    <SearchableSelect value={repaymentFilter} onChange={e => setRepaymentFilter(e.target.value)} options={debtorOptions} placeholder="Filter..." />
                </div>
             )}
             <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Link Expense</label>
             <SearchableSelect value={tempSelectId} onChange={e => handleLinkSelect(e.target.value)} options={linkableOptions} placeholder="Select expense..." />
             
             {linkedTxns.map(link => {
                 // Style Logic moved inside map for clarity
                 let textColor = 'text-gray-800 dark:text-gray-200';
                 let bgColor = 'bg-white dark:bg-gray-800';
                 let borderColor = 'border-gray-300 dark:border-gray-600';

                 if (link.relationType === 'product_refund') {
                     textColor = 'text-green-700 dark:text-green-400 font-medium';
                     bgColor = 'bg-green-50 dark:bg-green-900/20';
                     borderColor = 'border-green-200 dark:border-green-800';
                 } else {
                     const isOwedToMe = link.relationType === 'owed_to_me';
                     if (isOwedToMe) {
                         textColor = 'text-green-700 dark:text-green-400 font-medium';
                         bgColor = 'bg-green-50 dark:bg-green-900/20';
                         borderColor = 'border-green-200 dark:border-green-800';
                     } else {
                         textColor = 'text-red-700 dark:text-red-400 font-medium';
                         bgColor = 'bg-red-50 dark:bg-red-900/20';
                         borderColor = 'border-red-200 dark:border-red-800';
                     }
                 }

                 return (
                     <div key={link.id} className={`flex items-center gap-2 mt-2 p-2 rounded border ${bgColor} ${borderColor}`}>
                         <span className={`flex-1 truncate text-sm ${textColor}`}>{link.name}</span>
                         <input type="number" value={link.allocated} onChange={e => updateLinkedAllocation(link.id, e.target.value)} className="w-24 border rounded px-1 text-black dark:text-white dark:bg-gray-700" />
                         <button type="button" onClick={() => removeLinkedTxn(link.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                     </div>
                 );
             })}
             {linkedTxns.length > 0 && (
                <div className={`mt-2 text-xs font-medium flex justify-between ${isAllocationValid ? 'text-green-600' : 'text-red-500'}`}>
                    <span>Total Allocated: {formatCurrency(totalAllocated * 100)}</span>
                    <span>{isAllocationValid ? "✓ Matches" : `${formatCurrency(Math.abs(allocationDiff) * 100)} Diff`}</span>
                </div>
             )}
          </div>
      )}

      {/* Basic Fields */}
      <Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={handleAmountChange} required />
      <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      
      <SearchableSelect label="Category" value={category} onChange={e => handleQuickAddRequest(e.target.value, 'categories', 'Category')} options={categoryOptions} />
      <SearchableSelect label="Place" value={place} onChange={e => handleQuickAddRequest(e.target.value, 'places', 'Place')} options={placeOptions} />
      <SearchableSelect label="Tag" value={tag} onChange={e => handleQuickAddRequest(e.target.value, 'tags', 'Tag')} options={tagOptions} />
      <SearchableSelect label="Mode" value={mode} onChange={e => handleQuickAddRequest(e.target.value, 'modesOfPayment', 'Mode')} options={modeOptions} />
      
      <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-full" />

      {/* Inclusion Checks */}
      {(type === 'expense' || isProductRefund) && (
         <div className="col-span-full pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-6">
             <div className="flex items-center">
                <input type="checkbox" id="includeMe" checked={includeMe} onChange={e => setIncludeMe(e.target.checked)} className="h-5 w-5" />
                <label htmlFor="includeMe" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include <strong>Me</strong></label>
            </div>
            {payer !== 'me' && !selectedParticipants.includes(payer) && (
                 <div className="flex items-center">
                    <input type="checkbox" id="includePayer" checked={includePayer} onChange={e => setIncludePayer(e.target.checked)} className="h-5 w-5" />
                    <label htmlFor="includePayer" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include Payer</label>
                </div>
            )}
         </div>
      )}

      {/* Splitter */}
      {!isIncome && !isSettlement && (
         <>
            <div className="col-span-1 md:col-span-2 space-y-4 border-t pt-4 border-gray-200 dark:border-gray-700">
                <ParticipantSelector selectedIds={selectedParticipants} onAdd={handleParticipantAdd} onRemove={handleParticipantRemove} />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-4">
               <Select label="Split Method" value={splitMethod} onChange={(e) => setSplitMethod(e.target.value)} options={[{ value: 'equal', label: '1. Equal Split' }, { value: 'percentage', label: '2. Percentage Split' }, { value: 'dynamic', label: '3. Dynamic (Manual) Split' }]} />
               <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                   <SplitAllocator method={splitMethod} participants={splitAllocatorParticipants} totalAmount={Math.round(parseFloat(amount || 0) * 100)} splits={splits} onSplitChange={setSplits} />
                   {validation.message && <p className={`mt-2 text-sm ${validation.isValid ? 'text-green-600' : 'text-red-500'}`}>{validation.message}</p>}
               </div>
            </div>
         </>
      )}

      <div className="col-span-full flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
         {!isEditMode && <Button type="button" variant="secondary" onClick={handleTemplateSaveRequest} className="flex-1 py-3">Save as Template</Button>}
         <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="flex-1 py-3">Cancel</Button>
         <Button type="submit" className="flex-1 sm:grow-2 py-3 text-lg">{isEditMode ? 'Update' : 'Log'}</Button>
      </div>
    </form>
    
    <ConfirmModal isOpen={showDupeModal} title="Possible Duplicate" message={`Found similar transaction: <strong>${dupeTxn?.expenseName}</strong>. Add anyway?`} confirmText="Add Anyway" onConfirm={forceSubmit} onCancel={() => setShowDupeModal(false)} />
    <PromptModal isOpen={!!activePrompt} title={activePrompt?.title || ''} label={activePrompt?.label || ''} onConfirm={handlePromptConfirm} onCancel={() => setActivePrompt(null)} confirmText="Save" />
    </>
  );
};

export default TransactionForm;