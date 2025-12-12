import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const StatCard = ({
    title,
    value,
    subtitle,
    colorTheme = 'purple', // purple, blue, emerald, red, orange, dynamic
    className = '',
    projectedValue = null,
    showDiff = false
}) => {

    // Enhanced Theme Colors with Gradients
    const themes = {
        purple: {
            bg: 'bg-gradient-to-br from-purple-50/90 to-white/50 dark:from-purple-900/40 dark:to-gray-800/60',
            text: 'text-purple-700 dark:text-purple-300',
            label: 'text-purple-600/80',
            blob: 'from-purple-500/20 to-fuchsia-500/20',
            border: 'border-purple-100/50 dark:border-purple-500/20'
        },
        blue: {
            bg: 'bg-gradient-to-br from-blue-50/90 to-white/50 dark:from-blue-900/40 dark:to-gray-800/60',
            text: 'text-blue-700 dark:text-blue-300',
            label: 'text-blue-600/80',
            blob: 'from-blue-500/20 to-cyan-500/20',
            border: 'border-blue-100/50 dark:border-blue-500/20'
        },
        emerald: {
            bg: 'bg-gradient-to-br from-emerald-50/90 to-white/50 dark:from-emerald-900/40 dark:to-gray-800/60',
            text: 'text-emerald-700 dark:text-emerald-300',
            label: 'text-emerald-600/80',
            blob: 'from-emerald-500/20 to-teal-500/20',
            border: 'border-emerald-100/50 dark:border-emerald-500/20'
        },
        orange: {
            bg: 'bg-gradient-to-br from-orange-50/90 to-white/50 dark:from-orange-900/40 dark:to-gray-800/60',
            text: 'text-orange-700 dark:text-orange-300',
            label: 'text-orange-600/80',
            blob: 'from-orange-500/20 to-amber-500/20',
            border: 'border-orange-100/50 dark:border-orange-500/20'
        },
        gray: {
            bg: 'bg-white/90 dark:bg-gray-800/80',
            text: 'text-gray-900 dark:text-gray-100',
            label: 'text-gray-500',
            blob: 'from-gray-500/10 to-slate-500/10',
            border: 'border-gray-200/60 dark:border-gray-700/60'
        }
    };

    const selectedTheme = themes[colorTheme] || themes.gray;

    // Special handling for 'dynamic' which changes text color based on value but keeps a neutral background theme unless specified otherwise.
    // We'll use purple background theme for dynamic by default if not strictly "Net Position" context? 
    // Actually, let's default 'dynamic' to use Purple's background/border style but override text colors.
    const activeTheme = colorTheme === 'dynamic' ? themes.purple : selectedTheme;

    const renderDiff = () => {
        if (!showDiff || projectedValue == null) return null;
        const diff = projectedValue - value;
        if (Math.abs(diff) < 1) return null;

        // Logic: 
        // For Net Position: Positive Diff = Good (Green). Negative Diff = Bad (Red).
        // For Expenditure: Positive Diff = Spent More (Red?). Negative Diff = Spent Less (Green).
        // BUT consistent UI usually prefers Up=Green or Up=Red depending on metric.
        // Let's stick to standard numerical: UP arrow, Color dependent on context.
        // Assuming Net Position context for now mostly.

        const isPositive = diff > 0;
        const colorClass = isPositive ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : 'text-rose-600 bg-rose-50 dark:bg-rose-900/30';

        return (
            <span className={`text-xs font-bold ${colorClass} ml-2 flex items-center px-1.5 py-0.5 rounded-full`}>
                {isPositive ? '↑' : '↓'} {formatCurrency(Math.abs(diff))}
            </span>
        );
    };

    return (
        <div className={`
      relative overflow-hidden 
      p-4 sm:p-6 rounded-2xl 
      shadow-sm hover:shadow-md transition-all duration-300
      border ${activeTheme.border}
      ${activeTheme.bg}
      backdrop-blur-sm
      ${className}
    `}>
            {/* Decorative Gradient Blob */}
            <div className={`absolute -top-4 -right-4 w-24 h-24 bg-gradient-to-br ${activeTheme.blob} rounded-full blur-2xl pointer-events-none opacity-60`} />

            <h3 className="text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-semibold uppercase tracking-wider relative z-10 flex items-center gap-2">
                {title}
            </h3>

            <div className="mt-4 relative z-10">
                {projectedValue !== null ? (
                    // Comparison Layout
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Current</p>
                            <p className={`text-lg sm:text-2xl font-bold ${colorTheme === 'dynamic' ? (value >= 0 ? 'text-emerald-600' : 'text-rose-600') : activeTheme.text}`}>
                                {formatCurrency(value)}
                            </p>
                        </div>

                        <div className="px-2 pb-1 text-gray-300 dark:text-gray-600">
                            <ArrowRight size={20} />
                        </div>

                        <div className="text-right">
                            <p className={`text-xs font-bold mb-1 ${activeTheme.label}`}>Projected</p>
                            <p className={`text-xl sm:text-3xl font-bold ${colorTheme === 'dynamic' ? (projectedValue >= 0 ? 'text-emerald-600' : 'text-rose-600') : activeTheme.text}`}>
                                {formatCurrency(projectedValue)}
                            </p>
                        </div>
                    </div>
                ) : (
                    // Standard Layout
                    <div>
                        <div className={`text-3xl sm:text-4xl font-bold tracking-tight ${colorTheme === 'dynamic' ? (value >= 0 ? 'text-emerald-600' : 'text-rose-600') : activeTheme.text}`}>
                            {formatCurrency(value)}
                        </div>
                        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                    </div>
                )}
            </div>

            {/* Diff Badge (Bottom Right or inline?) */}
            {projectedValue !== null && showDiff && (
                <div className="mt-3 text-right relative z-10 flex justify-end">
                    {renderDiff()}
                </div>
            )}
        </div>
    );
};

export default StatCard;
