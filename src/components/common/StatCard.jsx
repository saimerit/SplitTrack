import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const StatCard = ({
    title,
    value,
    subtitle,
    colorTheme = 'gray', // purple, blue, emerald, orange, gray, dynamic
    className = '',
    projectedValue = null,
    showDiff = false,
    onClick,
    formatter = formatCurrency
}) => {

    // "Glass" Themes with refined gradients and borders
    const themes = {
        purple: {
            container: 'from-purple-50/80 to-white/40 dark:from-purple-900/20 dark:to-gray-900/40 border-purple-100/50 dark:border-purple-500/20',
            text: 'text-purple-700 dark:text-purple-300',
            icon: 'bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-300',
            blob: 'bg-purple-500/20'
        },
        blue: {
            container: 'from-sky-50/80 to-white/40 dark:from-sky-900/20 dark:to-gray-900/40 border-sky-100/50 dark:border-sky-500/20',
            text: 'text-sky-700 dark:text-sky-300',
            icon: 'bg-sky-100 text-sky-600 dark:bg-sky-900/50 dark:text-sky-300',
            blob: 'bg-sky-500/20'
        },
        emerald: {
            container: 'from-emerald-50/80 to-white/40 dark:from-emerald-900/20 dark:to-gray-900/40 border-emerald-100/50 dark:border-emerald-500/20',
            text: 'text-emerald-700 dark:text-emerald-300',
            icon: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-300',
            blob: 'bg-emerald-500/20'
        },
        orange: {
            container: 'from-orange-50/80 to-white/40 dark:from-orange-900/20 dark:to-gray-900/40 border-orange-100/50 dark:border-orange-500/20',
            text: 'text-orange-700 dark:text-orange-300',
            icon: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300',
            blob: 'bg-orange-500/20'
        },
        gray: {
            container: 'from-white/80 to-white/40 dark:from-gray-800/60 dark:to-gray-900/40 border-white/50 dark:border-gray-700/50',
            text: 'text-gray-900 dark:text-gray-100',
            icon: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
            blob: 'bg-gray-400/10'
        }
    };

    // Dynamic Logic: Defaults to gray container, but text changes
    let activeTheme = themes[colorTheme] || themes.gray;
    if (colorTheme === 'dynamic') {
        activeTheme = {
            ...themes.gray, // Base style
            text: value >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        };
    }

    const renderDiff = () => {
        if (!showDiff || projectedValue == null) return null;
        const diff = projectedValue - value;
        if (Math.abs(diff) < 0.01) return null;

        const isPositive = diff > 0;
        // Context: Usually "More Money" (Positive Net) is good. 
        // If this is strictly expense, the parent should pass a specific colorTheme.
        // We assume Green = Up, Red = Down for simplicity, or strictly based on math.
        const badgeColor = isPositive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300';

        return (
            <span className={`text-[10px] font-bold ${badgeColor} px-2 py-0.5 rounded-full flex items-center gap-1`}>
                {isPositive ? '↑' : '↓'} {formatter(Math.abs(diff))}
            </span>
        );
    };

    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-2xl p-5
                bg-gradient-to-br ${activeTheme.container}
                backdrop-blur-xl shadow-sm hover:shadow-lg hover:-translate-y-1
                border transition-all duration-300 ease-out
                ${onClick ? 'cursor-pointer' : ''}
                ${className}
            `}
        >
            {/* Ambient Glow Blob */}
            <div className={`absolute -top-6 -right-6 w-32 h-32 rounded-full blur-3xl opacity-40 ${activeTheme.blob}`} />

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {title}
                    </h3>
                    {projectedValue !== null && showDiff && renderDiff()}
                </div>

                {projectedValue !== null ? (
                    // Comparison Layout
                    <div className="mt-3">
                        <div className="flex items-baseline justify-between group">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">Current</p>
                                <p className={`text-xl sm:text-2xl font-bold ${activeTheme.text}`}>
                                    {formatCurrency(value)}
                                </p>
                            </div>

                            <ArrowRight size={18} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-400 transition-colors mx-2" />

                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">Projected</p>
                                <p className={`text-xl sm:text-2xl font-bold ${colorTheme === 'dynamic' ? (projectedValue >= 0 ? 'text-emerald-600' : 'text-rose-600') : activeTheme.text} opacity-90`}>
                                    {formatCurrency(projectedValue)}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Standard Layout
                    <div>
                        <div className={`text-2xl sm:text-3xl font-bold tracking-tight ${activeTheme.text}`}>
                            {formatter(value)}
                        </div>
                        {subtitle && <p className="text-xs font-medium text-gray-400 mt-1">{subtitle}</p>}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
