import React from 'react';
import { Filter, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../../utils/formatters';
import SearchableSelect from '../../common/SearchableSelect';

const ExpenseLinker = ({ ui, formData, setters, links, debtorOptions, linkableOptions }) => {
    if (!ui.isProductRefund && !ui.isSettlement && !ui.isForgiveness) return null;

    return (
        <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded border border-blue-100 dark:border-blue-800">
            {(ui.isSettlement || ui.isForgiveness) && (
                <div className="mb-4">
                    <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1 flex items-center gap-2">
                        <Filter size={12} /> Filter by Debtor
                    </label>
                    <SearchableSelect
                        value={formData.repaymentFilter}
                        onChange={e => setters.setRepaymentFilter(e.target.value)}
                        options={debtorOptions}
                        placeholder="Filter..."
                    />
                </div>
            )}
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Link Expense</label>
            <SearchableSelect
                value={links.tempId}
                onChange={e => links.handleSelect(e.target.value)}
                options={linkableOptions}
                placeholder="Select expense..."
            />

            {links.items.map(link => {
                let textColor = 'text-gray-800 dark:text-gray-200';
                let bgColor = 'bg-white dark:bg-gray-800';
                let borderColor = 'border-gray-300 dark:border-gray-600';

                // Check if allocation is negative (overpaid/credit scenario)
                const allocatedValue = parseFloat(link.allocated) || 0;
                const isNegativeAllocation = allocatedValue < 0;

                if (link.relationType === 'product_refund') {
                    textColor = 'text-green-700 dark:text-green-400 font-medium';
                    bgColor = 'bg-green-50 dark:bg-green-900/20';
                    borderColor = 'border-green-200 dark:border-green-800';
                } else if (isNegativeAllocation) {
                    // Overpaid/Credit - Orange styling
                    textColor = 'text-orange-700 dark:text-orange-400 font-medium';
                    bgColor = 'bg-orange-50 dark:bg-orange-900/20';
                    borderColor = 'border-orange-200 dark:border-orange-800';
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
                        <span className={`flex-1 truncate text-sm ${textColor}`}>
                            {link.name}
                            {isNegativeAllocation && <span className="ml-1 text-xs">(Overpaid)</span>}
                        </span>
                        <input
                            type="number"
                            value={link.allocated}
                            onChange={e => links.updateAlloc(link.id, e.target.value)}
                            className="w-24 border rounded px-1 text-black dark:text-white dark:bg-gray-700"
                        />
                        <button type="button" onClick={() => links.remove(link.id)} className="text-gray-400 hover:text-red-500">
                            <Trash2 size={14} />
                        </button>
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
    );
};

export default ExpenseLinker;
