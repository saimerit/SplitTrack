import { Plus, Trash2, Wand2 } from 'lucide-react';

/**
 * PaymentModeAllocator Component
 * Allows users to allocate a total amount across multiple payment methods.
 * Similar pattern to SplitAllocator but for payment modes instead of participants.
 * 
 * Props:
 * - breakdown: Array of { mode: string, amount: string } objects
 * - totalAmount: Total transaction amount in rupees (as string or number)
 * - modeOptions: Array of { name: string } payment mode options
 * - onAdd: Function to add a new payment mode row
 * - onRemove: Function to remove a payment mode row by index
 * - onUpdate: Function to update a payment mode (index, field, value)
 * - onAutoFill: Function to auto-fill remaining amount to last row
 * - remaining: Remaining unallocated amount (as string, in rupees)
 */
const PaymentModeAllocator = ({
    breakdown = [],
    totalAmount,
    modeOptions = [],
    onAdd,
    onRemove,
    onUpdate,
    onAutoFill,
    remaining
}) => {
    const remainingNum = parseFloat(remaining) || 0;
    const isBalanced = Math.abs(remainingNum) < 0.01;
    const hasOverflow = remainingNum < -0.01;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Payment Methods
                </span>
                <button
                    type="button"
                    onClick={onAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/20 rounded-lg border border-sky-200 dark:border-sky-800 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
                >
                    <Plus size={14} />
                    Add Mode
                </button>
            </div>

            {/* Payment Mode Rows */}
            {breakdown.length === 0 ? (
                <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">
                    Click "Add Mode" to split payment across methods
                </div>
            ) : (
                <div className="space-y-3">
                    {breakdown.map((item, index) => (
                        <div key={index} className="flex items-center gap-3">
                            {/* Mode Selector */}
                            <select
                                value={item.mode}
                                onChange={(e) => onUpdate(index, 'mode', e.target.value)}
                                className="flex-1 px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:text-gray-200"
                            >
                                <option value="">-- Select Mode --</option>
                                {modeOptions.map((mode) => (
                                    <option key={mode.name} value={mode.name}>
                                        {mode.name}
                                    </option>
                                ))}
                            </select>

                            {/* Amount Input */}
                            <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={item.amount}
                                    onChange={(e) => onUpdate(index, 'amount', e.target.value)}
                                    placeholder="0.00"
                                    className="w-full pl-7 pr-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:text-gray-200"
                                />
                            </div>

                            {/* Remove Button */}
                            <button
                                type="button"
                                onClick={() => onRemove(index)}
                                className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                                title="Remove"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Remaining Amount & Auto-Fill */}
            {breakdown.length > 0 && (
                <div className={`flex items-center justify-between p-3 rounded-lg border ${isBalanced
                        ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
                        : hasOverflow
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                    }`}>
                    <div className="text-sm">
                        <span className={`font-medium ${isBalanced
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : hasOverflow
                                    ? 'text-red-700 dark:text-red-400'
                                    : 'text-amber-700 dark:text-amber-400'
                            }`}>
                            {isBalanced
                                ? '✓ Balanced'
                                : hasOverflow
                                    ? `Overflow: ₹${Math.abs(remainingNum).toFixed(2)}`
                                    : `Remaining: ₹${remaining}`
                            }
                        </span>
                        {!isBalanced && !hasOverflow && (
                            <span className="text-gray-500 dark:text-gray-400 ml-2">
                                of ₹{parseFloat(totalAmount || 0).toFixed(2)}
                            </span>
                        )}
                    </div>

                    {!isBalanced && !hasOverflow && remainingNum > 0 && (
                        <button
                            type="button"
                            onClick={onAutoFill}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                        >
                            <Wand2 size={14} />
                            Auto-fill
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default PaymentModeAllocator;
