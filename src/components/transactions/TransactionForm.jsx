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

const SearchableSelect = ({ label, value, onChange, options, placeholder, className, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const [query, setQuery] = useState("");

    useEffect(() => {
        setTimeout(() => {
            if (!value) { setQuery(""); } else {
                const selected = options.find(o => o.value === value);
                if (selected) setQuery(selected.label);
            }
        }, 0);
    }, [value, options]);

    const filteredOptions = useMemo(() => {
        if (!query) return options;
        const lowerQuery = query.toLowerCase();
        const selected = options.find(o => o.value === value);
        if (selected && selected.label.toLowerCase() === lowerQuery) return options;
        return options.filter(opt => opt.label.toLowerCase().includes(lowerQuery));
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
                if (selected) setQuery(selected.label); else if (!value) setQuery('');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, value, options]);

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <div className="relative">
                <input type="text" value={query} onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder={placeholder || "Select..."} disabled={disabled} className="block w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400"><ChevronDown size={16} /></div>
            </div>
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => (
                            <div key={opt.value || idx} onClick={() => handleSelect(opt)} className={`px-4 py-2 cursor-pointer text-sm ${opt.className || ''} ${opt.value === value ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-200 font-medium' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'}`}>{opt.label}</div>
                        ))
                    ) : (<div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No matches found</div>)}
                </div>
            )}
        </div>
    );
};

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
    const navigate = useNavigate();
    const { formData, setters, ui, links, data, actions, utils } = useTransactionFormLogic(initialData, isEditMode);

    const generateOptions = (items, collectionName, label) => [
        { value: "", label: "-- Select --" },
        ...items.map(i => ({ value: i.name, label: i.name })),
        { value: `add_new_${collectionName}`, label: `+ Add New ${label}`, className: "text-sky-600 font-bold bg-sky-50 dark:bg-gray-700 dark:text-sky-400" }
    ];

    const categoryOptions = useMemo(() => generateOptions(data.categories, 'categories', 'Category'), [data.categories]);
    const placeOptions = useMemo(() => generateOptions(data.places, 'places', 'Place'), [data.places]);
    const tagOptions = useMemo(() => generateOptions(data.tags, 'tags', 'Tag'), [data.tags]);
    const modeOptions = useMemo(() => generateOptions(data.modesOfPayment, 'modesOfPayment', 'Mode'), [data.modesOfPayment]);
    const payerOptions = useMemo(() => [{ value: "me", label: "You (me)" }, ...data.allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [data.allParticipants]);
    const recipientOptions = useMemo(() => [{ value: "me", label: "You (me)" }, ...data.allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [data.allParticipants]);
    const debtorOptions = useMemo(() => [{ value: '', label: '-- Show All --' }, ...data.allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [data.allParticipants]);

    const { eligibleParents } = data;
    const { getName, getTxnDateStr } = utils;
    const { isSettlement } = ui;

    const linkableOptions = useMemo(() => {
        return [
            { value: '', label: '-- Select Expense to Link --' },
            ...eligibleParents.map(t => {
                if (!isSettlement) {
                    const rem = t.netAmount !== undefined ? t.netAmount : t.amount;
                    return { value: t.id, label: `${t.expenseName} (Refundable: ₹${(rem / 100).toFixed(2)}) - ${getTxnDateStr(t)}`, className: 'text-gray-800 dark:text-gray-200', data: t };
                }
                const isOwedToMe = t.relationType === 'owed_to_me';
                const sign = isOwedToMe ? '+' : '-';
                const colorClass = isOwedToMe ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium';
                const prefix = isOwedToMe ? `[${getName(t.counterParty)} owes You] ` : `[You owe ${getName(t.counterParty)}] `;
                return { value: t.id, label: `${prefix}${t.expenseName} (${sign}₹${(t.outstanding / 100).toFixed(2)}) - ${getTxnDateStr(t)}`, className: colorClass, data: t };
            }),
        ];
    }, [eligibleParents, getName, getTxnDateStr, isSettlement]);

    return (
        <>
            {ui.showSuccess && <SuccessAnimation message={isEditMode ? "Transaction Updated!" : "Transaction Logged!"} />}
            <form onSubmit={actions.handleSubmit} className="max-w-7xl mx-auto bg-white dark:bg-gray-800 p-4 sm:p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Space Switcher */}
                <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-sky-50 dark:bg-sky-900/10 p-3 rounded-lg border border-sky-100 dark:border-sky-900 mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Layers className="text-sky-600 dark:text-sky-400" size={20} />
                        <div className="flex flex-col">
                            <span className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase">Space</span>
                            <select value={formData.formGroupId} onChange={(e) => { setters.setFormGroupId(e.target.value); links.set([]); }} className="bg-transparent font-medium text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer">
                                <option value="personal">Personal</option>
                                {data.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
                                <input type="radio" name="txnType" value={t} checked={formData.type === t} onChange={() => actions.handleTypeChange(t)} className="peer sr-only" />
                                <div className={`text-center py-3 rounded-lg border transition-all font-medium capitalize ${formData.type === t ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-900 dark:border-sky-500 dark:text-sky-300' : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                                    {t === 'expense' ? 'Expense (Out)' : t === 'income' ? 'Income (In)' : 'Refund / Repayment'}
                                </div>
                            </label>
                        ))}
                    </div>
                </div>

                {ui.isRefundTab && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        {/* FIX: Stacked buttons on mobile to fix squishing */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <button type="button" onClick={() => actions.handleRefundSubTypeChange('product')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-sm border font-medium transition-colors ${!ui.isSettlement ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                                <RefreshCw size={18} className="shrink-0" />
                                <span>Product Refund</span>
                            </button>
                            <button type="button" onClick={() => actions.handleRefundSubTypeChange('settlement')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-sm border font-medium transition-colors ${ui.isSettlement ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                                <HandCoins size={18} className="shrink-0" />
                                <span>Peer Settlement</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Name Input */}
                <div className="col-span-1 md:col-span-2 lg:col-span-4 relative">
                    <Input label="Expense Name" value={formData.name} onChange={e => setters.setName(e.target.value)} required />
                    {ui.suggestion && (
                        <div onClick={actions.applySuggestion} className="absolute z-10 top-[70px] left-0 right-0 bg-indigo-50 dark:bg-indigo-900 border border-indigo-200 p-3 rounded shadow cursor-pointer">
                            <Sparkles size={18} className="inline mr-2 text-indigo-600 dark:text-indigo-400" />
                            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Suggestion found:</span> <span className="text-sm text-gray-600 dark:text-gray-400">{ui.suggestion.category} • {ui.suggestion.place}</span>
                        </div>
                    )}
                </div>

                {/* Payer Select */}
                <div className="col-span-1 lg:col-span-2">
                    {!ui.isIncome && <SearchableSelect label="Payer" value={formData.payer} onChange={e => actions.handlePayerChange(e.target.value)} options={payerOptions} placeholder="Search payer..." />}
                </div>

                {/* Recipient Select (Settlement) */}
                {ui.isSettlement && (
                    <div className="col-span-1 lg:col-span-2 flex items-end gap-2">
                        <div className="flex-1">
                            <SearchableSelect label="Recipient" value={formData.selectedParticipants[0] || ''} onChange={e => actions.handleRecipientChange(e.target.value)} options={recipientOptions} placeholder="Search recipient..." />
                        </div>
                        <button type="button" onClick={actions.handleManualSwap} className="p-3 mb-px bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-200 transition-colors">
                            <ArrowRightLeft size={18} className="text-gray-600 dark:text-gray-300" />
                        </button>
                    </div>
                )}

                {/* Linking Section */}
                {(ui.isProductRefund || ui.isSettlement) && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-100 dark:border-blue-800">
                        {ui.isSettlement && (
                            <div className="mb-4">
                                <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1 flex items-center gap-2"><Filter size={12} /> Filter by Debtor</label>
                                <SearchableSelect value={formData.repaymentFilter} onChange={e => setters.setRepaymentFilter(e.target.value)} options={debtorOptions} placeholder="Filter..." />
                            </div>
                        )}
                        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Link Expense</label>
                        <SearchableSelect value={links.tempId} onChange={e => links.handleSelect(e.target.value)} options={linkableOptions} placeholder="Select expense..." />

                        {links.items.map(link => {
                            let textColor = 'text-gray-800 dark:text-gray-200';
                            let bgColor = 'bg-white dark:bg-gray-800';
                            let borderColor = 'border-gray-300 dark:border-gray-600';

                            if (link.relationType === 'product_refund') {
                                textColor = 'text-green-700 dark:text-green-400 font-medium'; bgColor = 'bg-green-50 dark:bg-green-900/20'; borderColor = 'border-green-200 dark:border-green-800';
                            } else {
                                const isOwedToMe = link.relationType === 'owed_to_me';
                                if (isOwedToMe) { textColor = 'text-green-700 dark:text-green-400 font-medium'; bgColor = 'bg-green-50 dark:bg-green-900/20'; borderColor = 'border-green-200 dark:border-green-800'; } 
                                else { textColor = 'text-red-700 dark:text-red-400 font-medium'; bgColor = 'bg-red-50 dark:bg-red-900/20'; borderColor = 'border-red-200 dark:border-red-800'; }
                            }

                            return (
                                <div key={link.id} className={`flex items-center gap-2 mt-2 p-2 rounded border ${bgColor} ${borderColor}`}>
                                    <span className={`flex-1 truncate text-sm ${textColor}`}>{link.name}</span>
                                    <input type="number" value={link.allocated} onChange={e => links.updateAlloc(link.id, e.target.value)} className="w-24 border rounded px-1 text-black dark:text-white dark:bg-gray-700" />
                                    <button type="button" onClick={() => links.remove(link.id)} className="text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                                </div>
                            );
                        })}
                        {links.items.length > 0 && (
                            <div className={`mt-2 text-xs font-medium flex justify-between ${links.isValid ? 'text-green-600' : 'text-red-500'}`}>
                                <span>Total Allocated: {formatCurrency(links.totalAllocated * 100)}</span>
                                <span>{links.isValid ? "✓ Matches" : `${formatCurrency(Math.abs(links.allocationDiff) * 100)} Diff`}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Basic Fields */}
                <Input label="Amount (₹)" type="number" step="0.01" value={formData.amount} onChange={actions.handleAmountChange} required />
                <Input label="Date" type="date" value={formData.date} onChange={e => setters.setDate(e.target.value)} required />
                <SearchableSelect label="Category" value={formData.category} onChange={e => actions.handleQuickAddRequest(e.target.value, 'categories', 'Category')} options={categoryOptions} />
                <SearchableSelect label="Place" value={formData.place} onChange={e => actions.handleQuickAddRequest(e.target.value, 'places', 'Place')} options={placeOptions} />
                <SearchableSelect label="Tag" value={formData.tag} onChange={e => actions.handleQuickAddRequest(e.target.value, 'tags', 'Tag')} options={tagOptions} />
                <SearchableSelect label="Mode" value={formData.mode} onChange={e => actions.handleQuickAddRequest(e.target.value, 'modesOfPayment', 'Mode')} options={modeOptions} />
                <Input label="Description" value={formData.description} onChange={e => setters.setDescription(e.target.value)} className="col-span-full" />

                {/* Inclusion Checks */}
                {(formData.type === 'expense' || ui.isProductRefund) && (
                    <div className="col-span-full pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-6">
                        <div className="flex items-center">
                            <input type="checkbox" id="includeMe" checked={formData.includeMe} onChange={e => setters.setIncludeMe(e.target.checked)} className="h-5 w-5" />
                            <label htmlFor="includeMe" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include <strong>Me</strong></label>
                        </div>
                        {formData.payer !== 'me' && !formData.selectedParticipants.includes(formData.payer) && (
                            <div className="flex items-center">
                                <input type="checkbox" id="includePayer" checked={formData.includePayer} onChange={e => setters.setIncludePayer(e.target.checked)} className="h-5 w-5" />
                                <label htmlFor="includePayer" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include Payer</label>
                            </div>
                        )}
                    </div>
                )}

                {/* Splitter */}
                {!ui.isIncome && !ui.isSettlement && (
                    <>
                        <div className="col-span-1 md:col-span-2 space-y-4 border-t pt-4 border-gray-200 dark:border-gray-700">
                            <ParticipantSelector selectedIds={formData.selectedParticipants} onAdd={actions.handleParticipantAdd} onRemove={actions.handleParticipantRemove} />
                        </div>
                        <div className="col-span-1 md:col-span-2 space-y-4">
                            <Select label="Split Method" value={formData.splitMethod} onChange={(e) => setters.setSplitMethod(e.target.value)} options={[{ value: 'equal', label: '1. Equal Split' }, { value: 'percentage', label: '2. Percentage Split' }, { value: 'dynamic', label: '3. Dynamic (Manual) Split' }]} />
                            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                <SplitAllocator method={formData.splitMethod} participants={data.splitAllocatorParticipants} totalAmount={Math.round(parseFloat(formData.amount || 0) * 100)} splits={formData.splits} onSplitChange={setters.setSplits} />
                                {utils.validation.message && <p className={`mt-2 text-sm ${utils.validation.isValid ? 'text-green-600' : 'text-red-500'}`}>{utils.validation.message}</p>}
                            </div>
                        </div>
                    </>
                )}

                {/* Mobile-responsive button group */}
                <div className="col-span-full flex flex-col sm:flex-row gap-3 sm:gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex gap-3 sm:contents">
                        <Button type="button" variant="ghost" onClick={actions.resetForm} className="px-3 flex-none" title="Reset Form"><RefreshCw size={20} /></Button>
                        <Button type="button" variant="secondary" onClick={() => navigate(-1)} className="flex-1 py-3 text-sm sm:text-base">Cancel</Button>
                    </div>
                    {!isEditMode && (
                        <Button type="button" variant="secondary" onClick={actions.handleTemplateSaveRequest} className="flex-1 py-3 text-sm sm:text-base">
                            <span className="sm:hidden">Save Template</span><span className="hidden sm:inline">Save as Template</span>
                        </Button>
                    )}
                    <Button type="submit" className="flex-1 sm:grow-2 py-3 text-base sm:text-lg shadow-md">{isEditMode ? 'Update' : 'Log Transaction'}</Button>
                </div>
            </form>

            <ConfirmModal isOpen={ui.showDupeModal} title="Possible Duplicate" message={`Found similar transaction: <strong>${ui.dupeTxn?.expenseName}</strong>. Add anyway?`} confirmText="Add Anyway" onConfirm={actions.forceSubmit} onCancel={() => ui.setShowDupeModal(false)} />
            <PromptModal isOpen={!!ui.activePrompt} title={ui.activePrompt?.title || ''} label={ui.activePrompt?.label || ''} onConfirm={actions.handlePromptConfirm} onCancel={() => ui.setActivePrompt(null)} confirmText="Save" />
        </>
    );
};

export default TransactionForm;