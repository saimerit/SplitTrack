import { formatCurrency } from '../../utils/formatters';

/**
 * CreditDebtRatio - Visual progress bar showing credit vs debt ratio
 * Green = amount owed to you, Red = amount you owe
 */
const CreditDebtRatio = ({ credit = 0, debt = 0, className = '' }) => {
    const total = Math.abs(credit) + Math.abs(debt);
    const creditPercent = total > 0 ? (Math.abs(credit) / total) * 100 : 50;
    const debtPercent = total > 0 ? (Math.abs(debt) / total) * 100 : 50;

    const netPosition = credit - debt;
    const isPositive = netPosition >= 0;

    // If no data, show balanced state
    if (total === 0) {
        return (
            <div className={`glass-card p-5 ${className}`}>
                <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-[0.15em]">Credit / Debt Ratio</span>
                </div>
                <div className="h-3 w-full bg-gray-700/50 rounded-full overflow-hidden">
                    <div className="h-full w-1/2 bg-gray-500/50 rounded-full" />
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">No outstanding balances</p>
            </div>
        );
    }

    return (
        <div className={`glass-card p-5 ${className}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-3">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-[0.15em]">Credit / Debt Ratio</span>
                <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    Net: {formatCurrency(netPosition)}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="h-4 w-full bg-gray-800/50 rounded-full overflow-hidden flex">
                {/* Credit (Green) */}
                <div
                    className="h-full bg-linear-to-r from-emerald-600 to-emerald-400 transition-all duration-500 ease-out"
                    style={{ width: `${creditPercent}%` }}
                />
                {/* Debt (Red) */}
                <div
                    className="h-full bg-linear-to-r from-red-400 to-red-600 transition-all duration-500 ease-out"
                    style={{ width: `${debtPercent}%` }}
                />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-3 text-xs">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full" />
                    <span className="text-gray-400">Owed to you</span>
                    <span className="text-emerald-400 font-medium">{formatCurrency(credit)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-red-400 font-medium">{formatCurrency(debt)}</span>
                    <span className="text-gray-400">You owe</span>
                    <div className="w-2 h-2 bg-red-400 rounded-full" />
                </div>
            </div>
        </div>
    );
};

export default CreditDebtRatio;
