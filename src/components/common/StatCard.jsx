import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const StatCard = ({
    title,
    value,
    subtitle,
    colorTheme = 'purple', // purple, blue, emerald, red, orange
    className = '',
    projectedValue = null,
    showDiff = false
}) => {

    // Theme Color Maps
    const colors = {
        purple: { bg: 'bg-purple-100 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', label: 'text-purple-500' },
        blue: { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', label: 'text-blue-500' },
        emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/20', text: 'text-emerald-600 dark:text-emerald-400', label: 'text-emerald-500' },
        green: { bg: 'bg-green-100 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', label: 'text-green-500' },
        red: { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', label: 'text-red-500' },
        orange: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', label: 'text-orange-500' },
        gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', label: 'text-gray-500' }
    };

    const theme = colors[colorTheme] || colors.gray;

    const renderDiff = () => {
        if (!showDiff || projectedValue == null) return null;
        const diff = projectedValue - value;
        if (Math.abs(diff) < 1) return null;

        // For expenditure, negative diff is arguably "good", but usually UP is green for money gained.
        // Let's stick to strict numerical coloring: UP = Green, DOWN = Red?
        // Actually for Net Position: UP (more owed to me/less debt) is Green.
        // For Expenditure: UP (spending more) is Red? Context dependent.
        // Let's simplify: Green if positive, Red if negative diff. 
        // Wait, if I spend MORE, diff is Positive. That's usually Red context. 
        // But for Sandbox generic diff, standard color is fine.

        const isPositive = diff > 0;
        const diffColor = isPositive ? 'text-green-600' : 'text-red-600';

        return (
            <span className={`text-xs font-bold ${diffColor} ml-2 flex items-center bg-white/50 px-1 rounded`}>
                {isPositive ? '↑' : '↓'} {formatCurrency(Math.abs(diff))}
            </span>
        );
    };

    return (
        <div className={`p-4 sm:p-6 rounded-2xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-all ${className}`}>
            {/* Background Decorator */}
            <div className={`absolute top-0 right-0 w-20 h-20 ${theme.bg} rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110`}></div>

            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider relative z-10">{title}</h3>

            <div className="mt-4 relative z-10">
                {projectedValue !== null ? (
                    // Comparison Layout
                    <div className="flex items-end justify-between">
                        <div>
                            <p className="text-xs text-gray-400 mb-1">Current</p>
                            <p className={`text-lg sm:text-xl font-bold ${colorTheme === 'dynamic' ? (value >= 0 ? 'text-green-600' : 'text-red-600') : theme.text}`}>
                                {formatCurrency(value)}
                            </p>
                        </div>
                        <ArrowRight className="text-gray-300 mb-1" size={20} />
                        <div className="text-right">
                            <p className={`text-xs font-bold mb-1 ${theme.label}`}>Projected</p>
                            <p className={`text-xl sm:text-2xl font-bold ${colorTheme === 'dynamic' ? (projectedValue >= 0 ? 'text-green-600' : 'text-red-600') : theme.text}`}>
                                {formatCurrency(projectedValue)}
                            </p>
                        </div>
                    </div>
                ) : (
                    // Standard Layout
                    <div>
                        <div className={`text-2xl sm:text-3xl lg:text-4xl font-bold ${colorTheme === 'dynamic' ? (value >= 0 ? 'text-green-600' : 'text-red-600') : theme.text}`}>
                            {formatCurrency(value)}
                        </div>
                        {subtitle && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>}
                    </div>
                )}
            </div>

            {projectedValue !== null && showDiff && (
                <div className="mt-2 text-right relative z-10">
                    {renderDiff()}
                </div>
            )}
        </div>
    );
};

export default StatCard;
