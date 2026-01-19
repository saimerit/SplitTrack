import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Sparkles, Layers, ArrowRightLeft, Ban } from 'lucide-react';
import { useTransactionFormLogic } from '../../hooks/useTransactionForm';
import useAppStore from '../../store/useAppStore';
import useBudgetCheck from '../../hooks/useBudgetCheck';

import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import SplitAllocator from './SplitAllocator';
import PaymentModeAllocator from './PaymentModeAllocator';
import ParticipantSelector from './ParticipantSelector';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';
import SuccessAnimation from '../common/SuccessAnimation';
import SearchableSelect from '../common/SearchableSelect';
import TransactionTypeSelector from './form/TransactionTypeSelector';
import ExpenseLinker from './form/ExpenseLinker';
import NumberInput from '../common/NumberInput';

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
    const navigate = useNavigate();
    const { formData, setters, ui, links, data, actions, utils } = useTransactionFormLogic(initialData, isEditMode);

    // Extracted Budget Check Hook
    const { budgetWarning, checkBudget, setBudgetWarning } = useBudgetCheck(formData, isEditMode, initialData);

    // Wrap the original handleSubmit
    const originalHandleSubmit = actions.handleSubmit;
    const augmentedHandleSubmit = (e) => {
        e.preventDefault();
        if (checkBudget()) {
            originalHandleSubmit(e);
        }
    };

    const confirmBudget = () => {
        setBudgetWarning(null);
        originalHandleSubmit({ preventDefault: () => { } });
    };

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

    const { eligibleParents = [] } = data;
    const { getName, getTxnDateStr } = utils;
    const { isSettlement, isForgiveness } = ui;

    const linkableOptions = useMemo(() => {
        if (!eligibleParents) return [];
        return [
            { value: '', label: '-- Select Expense to Link --' },
            ...eligibleParents.map(t => {
                // For product refunds, show refundable amount
                if (!isSettlement && !isForgiveness) {
                    const rem = t.netAmount !== undefined ? t.netAmount : t.amount;
                    return { value: t.id, label: `${t.expenseName} (Refundable: ₹${(rem / 100).toFixed(2)}) - ${getTxnDateStr(t)}`, className: 'text-gray-800 dark:text-gray-200', data: t };
                }
                // For settlements and forgiveness, show counterParty's outstanding share
                const isOwedToMe = t.relationType === 'owed_to_me';
                const sign = isOwedToMe ? '+' : '-';
                const colorClass = isOwedToMe ? 'text-green-600 dark:text-green-400 font-medium' : 'text-red-600 dark:text-red-400 font-medium';
                const prefix = isOwedToMe ? `[${getName(t.counterParty)} owes You] ` : `[You owe ${getName(t.counterParty)}] `;
                return { value: t.id, label: `${prefix}${t.expenseName} (${sign}₹${(t.outstanding / 100).toFixed(2)}) - ${getTxnDateStr(t)}`, className: colorClass, data: t };
            }),
        ];
    }, [eligibleParents, getName, getTxnDateStr, isSettlement, isForgiveness]);

    return (
        <>
            {ui.showSuccess && <SuccessAnimation message={isEditMode ? "Transaction Updated!" : "Transaction Logged!"} />}
            <form onSubmit={augmentedHandleSubmit} className="max-w-7xl mx-auto bg-white dark:bg-gray-800 p-4 sm:p-6 md:p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

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

                {/* Transaction Type Selector (Extracted) */}
                <TransactionTypeSelector currentType={formData.type} onTypeChange={actions.handleTypeChange} />

                {/* Refund Sub-types */}
                {ui.isRefundTab && (
                    <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <Button type="button" onClick={() => actions.handleRefundSubTypeChange('product')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-sm border font-medium transition-colors ${ui.isProductRefund ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                                <RefreshCw size={18} className="shrink-0" />
                                <span>Product Refund</span>
                            </Button>
                            <Button type="button" onClick={() => actions.handleRefundSubTypeChange('settlement')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-sm border font-medium transition-colors ${ui.isSettlement ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                                <ArrowRightLeft size={18} className="shrink-0" />
                                <span>Peer Settlement</span>
                            </Button>
                            <Button type="button" onClick={() => actions.handleRefundSubTypeChange('forgiveness')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md text-sm border font-medium transition-colors ${ui.isForgiveness ? 'bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                                <Ban size={18} className="shrink-0" />
                                <span>Forgive Debt</span>
                            </Button>
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

                {/* Linking Section (Extracted) */}
                <ExpenseLinker
                    ui={ui}
                    formData={formData}
                    setters={setters}
                    links={links}
                    debtorOptions={debtorOptions}
                    linkableOptions={linkableOptions}
                />

                {/* Smart Amount Input (Refactored to Safe NumberInput) */}
                <div className="col-span-full flex flex-col items-center justify-center py-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl mb-2">
                    <label className="text-sm font-medium text-gray-500 mb-1">Amount</label>
                    <div className="flex items-baseline text-gray-900 dark:text-white">
                        <span className="text-3xl font-light mr-1">₹</span>
                        <NumberInput
                            value={formData.amount}
                            onChange={actions.handleAmountChange}
                            placeholder="0"
                            className="text-5xl font-bold bg-transparent border-none focus:ring-0 p-0 w-48 text-center placeholder-gray-300 dark:placeholder-gray-700 focus:outline-none"
                            autoFocus
                        />
                    </div>
                </div>
                <Input label="Date" type="date" value={formData.date} onChange={e => setters.setDate(e.target.value)} required />
                <SearchableSelect label="Category" value={formData.category} onChange={e => actions.handleQuickAddRequest(e.target.value, 'categories', 'Category')} options={categoryOptions} />
                <SearchableSelect label="Place" value={formData.place} onChange={e => actions.handleQuickAddRequest(e.target.value, 'places', 'Place')} options={placeOptions} />
                <SearchableSelect label="Tag" value={formData.tag} onChange={e => actions.handleQuickAddRequest(e.target.value, 'tags', 'Tag')} options={tagOptions} />

                {/* Payment Mode - Single or Multi-Mode */}
                <div className="col-span-1 lg:col-span-2">
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Mode</label>
                        <button
                            type="button"
                            onClick={() => {
                                if (!formData.isMultiMode && formData.paymentBreakdown.length === 0) {
                                    // Initialize with first row when enabling
                                    actions.addPaymentMode();
                                }
                                setters.setIsMultiMode(!formData.isMultiMode);
                            }}
                            className={`text-xs font-medium px-3 py-1 rounded-full transition-colors ${formData.isMultiMode
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                        >
                            {formData.isMultiMode ? '✓ Multi-Mode' : 'Multi-Mode'}
                        </button>
                    </div>

                    {formData.isMultiMode ? (
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-700">
                            <PaymentModeAllocator
                                breakdown={formData.paymentBreakdown}
                                totalAmount={formData.amount}
                                modeOptions={data.modesOfPayment}
                                onAdd={actions.addPaymentMode}
                                onRemove={actions.removePaymentMode}
                                onUpdate={actions.updatePaymentMode}
                                onAutoFill={actions.autoFillLastMode}
                                remaining={utils.getMultiModeRemaining()}
                            />
                        </div>
                    ) : (
                        <SearchableSelect
                            value={formData.mode}
                            onChange={e => actions.handleQuickAddRequest(e.target.value, 'modesOfPayment', 'Mode')}
                            options={modeOptions}
                        />
                    )}
                </div>

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
                            <ParticipantSelector selectedIds={formData.selectedParticipants} onAdd={actions.handleParticipantAdd} onRemove={actions.handleParticipantRemove} onGroupAdd={actions.handleGroupAdd} />
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
            <ConfirmModal
                isOpen={!!budgetWarning}
                title="⚠️ Budget Warning"
                message={budgetWarning?.message || ''}
                onConfirm={confirmBudget}
                onCancel={() => setBudgetWarning(null)}
                confirmText="Proceed"
            />
            <PromptModal isOpen={!!ui.activePrompt} title={ui.activePrompt?.title || ''} label={ui.activePrompt?.label || ''} onConfirm={actions.handlePromptConfirm} onCancel={() => ui.setActivePrompt(null)} confirmText="Save" />
        </>
    );
};

export default TransactionForm;