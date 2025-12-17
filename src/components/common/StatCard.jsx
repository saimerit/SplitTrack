import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

const StatCard = ({
    title,
    value,
    subtitle,
    colorTheme = 'blue', // purple, blue, emerald, orange, gray, dynamic
    className = '',
    projectedValue = null,
    showDiff = false,
    delay = 0,
    onClick,
    formatter = formatCurrency
}) => {

    const themes = {
        blue: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20",
        emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
        purple: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20",
        orange: "from-orange-500/20 to-orange-600/5 text-orange-400 border-orange-500/20",
        gray: "from-gray-500/20 to-gray-600/5 text-gray-400 border-gray-500/20",
        dynamic: value >= 0
            ? "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20"
            : "from-red-500/20 to-red-600/5 text-red-400 border-red-500/20"
    };

    const activeThemeKey = colorTheme === 'dynamic' ? (value >= 0 ? 'emerald' : 'dynamic') : colorTheme;
    // Fallback if specific color scheme maps weirdly or just use activeTheme string
    const activeTheme = themes[colorTheme] || themes.blue;

    // For icon selection
    const Icon = (colorTheme === 'dynamic' && value < 0) ? TrendingDown : TrendingUp;

    const renderDiff = () => {
        if (!showDiff || projectedValue == null) return null;
        const diff = projectedValue - value;
        if (Math.abs(diff) < 0.01) return null;

        const isPositive = diff > 0;
        const badgeColor = isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400';

        return (
            <span className={`text-[10px] font-bold ${badgeColor} px-2 py-0.5 rounded-full flex items-center gap-1 ml-auto`}>
                {isPositive ? '↑' : '↓'} {formatter(Math.abs(diff))}
            </span>
        );
    };

    return (
        <div
            onClick={onClick}
            className={`glass-card relative overflow-hidden p-6 group animate-enter-card ${className} ${onClick ? 'cursor-pointer' : ''}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Background Glow Blob */}
            <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${activeTheme} opacity-40 blur-2xl group-hover:opacity-60 transition-opacity duration-500 pointer-events-none`} />

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-4">
                    <span className="text-sm font-medium text-gray-400 uppercase tracking-wider">{title}</span>
                    {projectedValue !== null && showDiff ? (
                        renderDiff()
                    ) : (
                        <div className={`p-2 rounded-lg bg-white/5 border border-white/10 ${activeTheme.split(' ')[2]}`}>
                            <Icon size={18} />
                        </div>
                    )}
                </div>

                {projectedValue !== null ? (
                    // Comparison Layout (Preserved Logic)
                    <div className="mt-1">
                        <div className="flex items-baseline justify-between group">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">Current</p>
                                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                                    {formatter(value)}
                                </h3>
                            </div>

                            <ArrowRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors mx-2" />

                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold">Projected</p>
                                <h3 className={`text-xl sm:text-2xl font-bold tracking-tight ${colorTheme === 'dynamic' ? (projectedValue >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-300'} opacity-90`}>
                                    {formatter(projectedValue)}
                                </h3>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Standard Layout
                    <div>
                        <h3 className="text-3xl font-bold text-white tracking-tight">
                            {typeof value === 'number' ? formatter(value) : value}
                        </h3>
                        {subtitle && (
                            <p className="text-xs text-gray-500 mt-1 font-medium group-hover:text-gray-400 transition-colors">
                                {subtitle}
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatCard;
