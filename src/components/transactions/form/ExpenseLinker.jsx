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

                // Check if allocation is negative (settlement direction flip)
                const allocatedValue = parseFloat(link.allocated) || 0;
                const isNegativeAllocation = allocatedValue < 0;

                // Determine if this item is a credit link
                const isCreditItem = link.relationType === 'credit_link' || (isNegativeAllocation && ui.isSettlement);

                // Style logic
                if (link.relationType === 'product_refund') {
                    textColor = 'text-green-700 dark:text-green-400 font-medium';
                    bgColor = 'bg-green-50 dark:bg-green-900/20';
                    borderColor = 'border-green-200 dark:border-green-800';
                } else if (isNegativeAllocation) {
                    // Negative settlement allocation
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
                <div className={`mt-2 text-xs font-medium flex justify-between ${links.basketDiff === 0 ? 'text-green-600 dark:text-green-400' :
                    links.basketDiff > 0 ? 'text-orange-600 dark:text-orange-400' : // Positive = Overpaid (Surplus) IF Amount > Debt. Wait.
                        // Logic check: basketDiff = Payment (1500) - Debt (1000) = +500.
                        // User said: "difference is positive then partial"??
                        // Let's re-read user request: "if difference is positive then partial".
                        // My basketDiff = Payment - Debt.
                        // If Payment (500) - Debt (1000) = -500. (Negative).
                        // If Payment (1500) - Debt (1000) = +500. (Positive).
                        // User said:
                        // "total linked amount and amount entered difference is positive then partial"
                        // Diff = Linked (1000) - Entered (500) = +500. -> Partial.
                        // Diff = Linked (1000) - Entered (1500) = -500. -> Overpaid.
                        //
                        // My basketDiff is calculated as: Payment - Debt.
                        // So my basketDiff is -1 * User's Diff.
                        //
                        // My basketDiff:
                        // -500 (Deficit/Partial)
                        // +500 (Surplus/Overpaid)
                        //
                        // So:
                        // basketDiff < 0 -> Partial
                        // basketDiff > 0 -> Overpaid

                        'text-purple-600 dark:text-purple-400' // Partial
                    }`}>
                    <span>Total Allocated in Links: {formatCurrency(links.totalMaxAllocatable * 100)}</span>
                    <span>
                        {links.basketDiff === 0
                            ? "✓ Matches"
                            : links.basketDiff < 0
                                ? `Partial: ${formatCurrency(Math.abs(links.basketDiff) * 100)} remaining`
                                : `Overpaid: ${formatCurrency(links.basketDiff * 100)} extra`
                        }
                    </span>
                </div>
            )}
        </div>
    );
};

export default ExpenseLinker;
