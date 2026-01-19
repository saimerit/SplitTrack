import { useMemo } from 'react';
import { Wallet, TrendingUp, RefreshCcw } from 'lucide-react';

/**
 * Segmented Control for Transaction Type
 * Modern sliding tab design with smooth transitions
 */
const TransactionTypeSelector = ({ currentType, onTypeChange }) => {
    const types = useMemo(() => [
        { id: 'expense', label: 'Expense', shortLabel: 'Out', icon: Wallet, color: 'rose' },
        { id: 'income', label: 'Income', shortLabel: 'In', icon: TrendingUp, color: 'emerald' },
        { id: 'refund', label: 'Refund', shortLabel: 'Return', icon: RefreshCcw, color: 'purple' }
    ], []);

    const activeIndex = types.findIndex(t => t.id === currentType);

    return (
        <div className="col-span-1 md:col-span-2 lg:col-span-4">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-3">
                Transaction Type
            </label>

            {/* Segmented Control Container */}
            <div className="relative p-1 bg-white/5 dark:bg-gray-800/50 rounded-2xl border border-white/10 backdrop-blur-sm">
                {/* Sliding Background Indicator */}
                <div
                    className="absolute top-1 bottom-1 transition-all duration-300 ease-out rounded-xl bg-linear-to-r from-sky-500/20 to-indigo-500/20 border border-white/10"
                    style={{
                        width: `calc(${100 / types.length}% - 4px)`,
                        left: `calc(${(activeIndex / types.length) * 100}% + 2px)`
                    }}
                />

                {/* Buttons */}
                <div className="relative flex">
                    {types.map((t) => {
                        const Icon = t.icon;
                        const isActive = currentType === t.id;

                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => onTypeChange(t.id)}
                                className={`
                                    flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                                    text-sm font-semibold transition-all duration-200 haptic-tap
                                    ${isActive
                                        ? 'text-white'
                                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                    }
                                `}
                            >
                                <Icon size={18} className={isActive ? 'text-sky-400' : ''} />
                                <span className="hidden sm:inline">{t.label}</span>
                                <span className="sm:hidden">{t.shortLabel}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default TransactionTypeSelector;

