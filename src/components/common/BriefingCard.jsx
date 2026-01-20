import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Lightbulb } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

/**
 * BriefingCard - AI-style spending summary card
 * Shows intelligent insights about spending trends
 */
const BriefingCard = ({ transactions = [], participants = [] }) => {
    // Calculate spending insights
    const insights = useMemo(() => {
        if (!transactions || transactions.length === 0) {
            return { hasData: false, messages: [] };
        }

        const now = new Date();
        const thisWeekStart = new Date(now);
        thisWeekStart.setDate(now.getDate() - 7);
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(thisWeekStart.getDate() - 7);

        // Filter transactions by week
        const thisWeekTxns = transactions.filter(t => {
            if (t.isDeleted) return false;
            const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            return date >= thisWeekStart && t.type !== 'income';
        });

        const lastWeekTxns = transactions.filter(t => {
            if (t.isDeleted) return false;
            const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            return date >= lastWeekStart && date < thisWeekStart && t.type !== 'income';
        });

        // Calculate category spending
        const categorySpending = {};
        thisWeekTxns.forEach(t => {
            const cat = t.category || 'Other';
            const myShare = t.splits?.me || 0;
            categorySpending[cat] = (categorySpending[cat] || 0) + myShare;
        });

        const lastWeekCategorySpending = {};
        lastWeekTxns.forEach(t => {
            const cat = t.category || 'Other';
            const myShare = t.splits?.me || 0;
            lastWeekCategorySpending[cat] = (lastWeekCategorySpending[cat] || 0) + myShare;
        });

        const messages = [];

        // Find biggest change category
        let maxChange = 0;
        let maxChangeCat = null;
        let isIncrease = true;

        Object.entries(categorySpending).forEach(([cat, amount]) => {
            const lastAmount = lastWeekCategorySpending[cat] || 0;
            if (lastAmount > 0) {
                const change = ((amount - lastAmount) / lastAmount) * 100;
                if (Math.abs(change) > Math.abs(maxChange)) {
                    maxChange = change;
                    maxChangeCat = cat;
                    isIncrease = change > 0;
                }
            }
        });

        if (maxChangeCat && Math.abs(maxChange) > 10) {
            messages.push({
                type: isIncrease ? 'warning' : 'success',
                text: `You spent ${Math.abs(Math.round(maxChange))}% ${isIncrease ? 'more' : 'less'} on "${maxChangeCat}" this week`,
                icon: isIncrease ? TrendingUp : TrendingDown
            });
        }

        // Total this week vs last week
        const thisWeekTotal = thisWeekTxns.reduce((sum, t) => sum + (t.splits?.me || 0), 0);
        const lastWeekTotal = lastWeekTxns.reduce((sum, t) => sum + (t.splits?.me || 0), 0);

        if (lastWeekTotal > 0) {
            const weekChange = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
            if (Math.abs(weekChange) > 5) {
                messages.push({
                    type: weekChange > 0 ? 'neutral' : 'success',
                    text: `Weekly spending is ${weekChange > 0 ? 'up' : 'down'} ${Math.abs(Math.round(weekChange))}% (${formatCurrency(thisWeekTotal)})`,
                    icon: weekChange > 0 ? TrendingUp : TrendingDown
                });
            }
        }

        // Top spending category
        const topCategory = Object.entries(categorySpending)
            .sort(([, a], [, b]) => b - a)[0];

        if (topCategory) {
            messages.push({
                type: 'info',
                text: `Top category: "${topCategory[0]}" at ${formatCurrency(topCategory[1])}`,
                icon: Lightbulb
            });
        }

        return { hasData: messages.length > 0, messages };
    }, [transactions]);

    if (!insights.hasData) {
        return null;
    }

    return (
        <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Lightbulb size={16} className="text-white" />
                </div>
                <h3 className="text-sm font-semibold text-gray-300">Weekly Briefing</h3>
            </div>

            <div className="space-y-2">
                {insights.messages.slice(0, 3).map((msg, idx) => (
                    <div
                        key={idx}
                        className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${msg.type === 'warning' ? 'bg-amber-500/10 border border-amber-500/20' :
                            msg.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                                'bg-white/5 border border-white/10'
                            }`}
                    >
                        <msg.icon
                            size={16}
                            className={`mt-0.5 shrink-0 ${msg.type === 'warning' ? 'text-amber-400' :
                                msg.type === 'success' ? 'text-emerald-400' :
                                    'text-gray-400'
                                }`}
                        />
                        <p className="text-sm text-gray-300">{msg.text}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BriefingCard;
