import React from 'react';

const TransactionTypeSelector = ({ currentType, onTypeChange }) => {
    return (
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Type</label>
            <div className="flex flex-col sm:flex-row gap-4">
                {['expense', 'income', 'refund'].map(t => (
                    <label key={t} className="flex-1 cursor-pointer group">
                        <input
                            type="radio"
                            name="txnType"
                            value={t}
                            checked={currentType === t}
                            onChange={() => onTypeChange(t)}
                            className="peer sr-only"
                        />
                        <div className={`text-center py-3 rounded-lg border transition-all font-medium capitalize ${currentType === t
                            ? 'bg-sky-50 border-sky-500 text-sky-700 dark:bg-sky-900 dark:border-sky-500 dark:text-sky-300'
                            : 'border-gray-300 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}>
                            {t === 'expense' ? 'Expense (Out)' : t === 'income' ? 'Income (In)' : 'Refund / Repayment'}
                        </div>
                    </label>
                ))}
            </div>
        </div>
    );
};

export default TransactionTypeSelector;
