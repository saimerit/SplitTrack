import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import Sparkline from '../charts/Sparkline';

// Loading Skeleton Component
const StatCardSkeleton = () => (
    <div className="glass-card-elevated relative overflow-hidden p-6 animate-pulse">
        <div className="flex justify-between items-start mb-4">
            <div className="h-4 w-24 bg-white/10 rounded"></div>
            <div className="h-8 w-8 bg-white/10 rounded-lg"></div>
        </div>
        <div className="h-8 w-32 bg-white/10 rounded mt-2"></div>
        <div className="h-3 w-20 bg-white/5 rounded mt-3"></div>
    </div>
);

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
    formatter = formatCurrency,
    isLoading = false,
    sparklineData = null // NEW: 7-day trend data
}) => {

    // Show skeleton when loading
    if (isLoading) {
        return <StatCardSkeleton />;
    }

    const themes = {
        blue: "from-blue-500/20 to-blue-600/5 text-blue-400 border-blue-500/20",
        emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20",
        purple: "from-purple-500/20 to-purple-600/5 text-purple-400 border-purple-500/20",
        orange: "from-orange-500/20 to-orange-600/5 text-orange-400 border-orange-500/20",
        gray: "from-gray-500/20 to-gray-600/5 text-gray-400 border-gray-500/20",
        rose: "from-rose-500/20 to-rose-600/5 text-rose-400 border-rose-500/20",
        dynamic: value >= 0
            ? "from-emerald-500/20 to-emerald-600/5 text-emerald-400 border-emerald-500/20"
            : "from-red-500/20 to-red-600/5 text-red-400 border-red-500/20"
    };

    const sparklineColors = {
        blue: 'text-blue-400',
        emerald: 'text-emerald-400',
        purple: 'text-purple-400',
        orange: 'text-orange-400',
        gray: 'text-gray-400',
        rose: 'text-rose-400',
        dynamic: value >= 0 ? 'text-emerald-400' : 'text-red-400'
    };

    const activeThemeKey = colorTheme === 'dynamic' ? (value >= 0 ? 'emerald' : 'dynamic') : colorTheme;
    // Fallback if specific color scheme maps weirdly or just use activeTheme string
    const activeTheme = themes[colorTheme] || themes.blue;
    const sparklineColor = sparklineColors[colorTheme] || 'text-sky-400';

    // For icon selection
    const Icon = (colorTheme === 'dynamic' && value < 0) ? TrendingDown : TrendingUp;

    const renderDiff = () => {
        if (!showDiff || projectedValue == null) return null;
        const diff = projectedValue - value;
        if (Math.abs(diff) < 0.01) return null;

        const isPositive = diff > 0;
        const badgeColor = isPositive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400';

        return (
            <span className={`text-[10px] font-bold ${badgeColor} px-2 py-0.5 rounded-full flex items-center gap-1 ml-auto tabular-nums`}>
                {isPositive ? '↑' : '↓'} {formatter(Math.abs(diff))}
            </span>
        );
    };

    return (
        <div
            onClick={onClick}
            className={`glass-card-elevated radial-glow dynamic-glow relative overflow-hidden p-6 group animate-enter-card ${className} ${onClick ? 'cursor-pointer' : ''}`}
            style={{ animationDelay: `${delay}ms` }}
        >
            {/* Background Glow Blob - Now with gradient-shift animation on hover */}
            <div className={`absolute -right-6 -top-6 h-28 w-28 rounded-full bg-linear-to-br ${activeTheme} opacity-40 blur-2xl group-hover:opacity-70 group-hover:scale-110 transition-all duration-500 pointer-events-none`} />

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="flex justify-between items-start mb-4">
                    {/* Enhanced Typography: tracking-widest + font-medium */}
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-[0.15em]">{title}</span>
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
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Current</p>
                                <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight tabular-nums">
                                    {formatter(value)}
                                </h3>
                            </div>

                            <ArrowRight size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors mx-2" />

                            <div className="text-right">
                                <p className="text-[10px] text-gray-400 uppercase font-semibold tracking-wider">Projected</p>
                                <h3 className={`text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${colorTheme === 'dynamic' ? (projectedValue >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-gray-300'} opacity-90`}>
                                    {formatter(projectedValue)}
                                </h3>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Standard Layout with optional Sparkline
                    <div className="flex items-end justify-between gap-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-3xl font-bold text-white tracking-tight tabular-nums">
                                {typeof value === 'number' ? formatter(value) : value}
                            </h3>
                            {subtitle && (
                                <p className="text-xs text-gray-500 mt-1 font-medium group-hover:text-gray-400 transition-colors truncate">
                                    {subtitle}
                                </p>
                            )}
                        </div>
                        {/* Sparkline - 7-day trend mini-chart */}
                        {sparklineData && sparklineData.length > 0 && (
                            <Sparkline data={sparklineData} color={sparklineColor} className="w-16 shrink-0" />
                        )}
                    </div>
                )}
            </div>

            {/* Hover "View Details" Arrow - Micro-interaction */}
            <div className="absolute bottom-3 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <ArrowRight size={14} className="text-white/40" />
            </div>
        </div>
    );
};

export default StatCard;


