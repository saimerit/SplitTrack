import { useMemo } from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { useBalances } from '../../hooks/useBalances';
import { formatCurrency } from '../../utils/formatters';

/**
 * SidebarMetrics - Live metrics section for sidebar bottom
 * Shows net balance sparkline with real 7-day trend and monthly budget progress
 */
const SidebarMetrics = () => {
    const { transactions, participants, goals } = useAppStore();
    const stats = useBalances(transactions, participants);

    // Calculate real 7-day netPosition trend from transactions
    const weeklyTrend = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        // Create array for last 7 days
        const dailyNet = [];

        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(today);
            dayStart.setDate(today.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);

            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            // Calculate cumulative netPosition up to this day
            let dayNet = 0;

            transactions.forEach(txn => {
                if (txn.isDeleted) return;

                let txnDate;
                if (txn.timestamp?.toDate) txnDate = txn.timestamp.toDate();
                else if (txn.timestamp instanceof Date) txnDate = txn.timestamp;
                else txnDate = new Date(txn.timestamp || 0);

                // Only count transactions up to this day
                if (txnDate <= dayEnd) {
                    const payer = txn.payer || 'me';
                    const splits = txn.splits || {};
                    const amount = parseFloat(txn.amount) || 0;

                    if (txn.type === 'income') return;

                    if (txn.isReturn) {
                        const recipient = txn.participants?.[0];
                        if (!recipient) return;
                        if (payer === 'me' && recipient !== 'me') {
                            dayNet += txn.isForgiveness ? 0 : amount;
                        } else if (recipient === 'me' && payer !== 'me') {
                            dayNet -= amount;
                        }
                    } else {
                        if (payer === 'me') {
                            Object.entries(splits).forEach(([uid, share]) => {
                                if (uid !== 'me') dayNet += share;
                            });
                        } else {
                            const myShare = splits['me'] || 0;
                            if (myShare > 0) dayNet -= myShare;
                        }
                    }
                }
            });

            dailyNet.push(dayNet);
        }

        return dailyNet;
    }, [transactions]);

    // Get current month's budget goal if exists
    const monthlyBudget = useMemo(() => {
        if (!goals || goals.length === 0) return null;
        const budgetGoal = goals.find(g => g.type === 'budget' && g.isActive);
        return budgetGoal;
    }, [goals]);

    // Calculate budget progress
    const budgetProgress = useMemo(() => {
        if (!monthlyBudget) return null;
        const spent = stats.myTotalShare || 0;
        const limit = monthlyBudget.targetAmount || 0;
        if (limit === 0) return null;
        return Math.min((spent / limit) * 100, 100);
    }, [monthlyBudget, stats.myTotalShare]);

    const isPositive = stats.netPosition >= 0;

    // Normalize trend data for sparkline display
    const normalizedTrend = useMemo(() => {
        const max = Math.max(...weeklyTrend.map(Math.abs), 1);
        return weeklyTrend.map(v => (Math.abs(v) / max) * 100);
    }, [weeklyTrend]);

    return (
        <div className="px-3 py-4 border-t border-white/10 shrink-0 space-y-3">
            {/* Net Position Indicator */}
            <div className="glass-card-surface p-3 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Net Position</span>
                    {isPositive ? (
                        <TrendingUp size={14} className="text-emerald-400" />
                    ) : (
                        <TrendingDown size={14} className="text-rose-400" />
                    )}
                </div>
                <div className={`text-lg font-bold tabular-nums currency-value ${isPositive ? 'text-emerald-400 neon-glow-emerald' : 'text-rose-400 neon-glow-rose'}`}>
                    {isPositive ? '+' : ''}{formatCurrency(stats.netPosition)}
                </div>

                {/* Real 7-Day Sparkline */}
                <div className="mt-2 flex items-end gap-0.5 h-4">
                    {normalizedTrend.map((height, i) => (
                        <div
                            key={i}
                            className={`flex-1 rounded-sm transition-all duration-300 ${i === normalizedTrend.length - 1
                                    ? (isPositive ? 'bg-emerald-400' : 'bg-rose-400')
                                    : (isPositive ? 'bg-emerald-400/40' : 'bg-rose-400/40')
                                }`}
                            style={{ height: `${Math.max(15, height)}%` }}
                        />
                    ))}
                </div>
            </div>

            {/* Budget Progress */}
            {budgetProgress !== null && (
                <div className="glass-card-surface p-3 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">Monthly Budget</span>
                        <Wallet size={14} className="text-indigo-400" />
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${budgetProgress > 90 ? 'bg-rose-500' :
                                    budgetProgress > 70 ? 'bg-amber-500' : 'bg-indigo-500'
                                    }`}
                                style={{ width: `${budgetProgress}%` }}
                            />
                        </div>
                        <span className="text-xs font-mono text-gray-400">{Math.round(budgetProgress)}%</span>
                    </div>
                </div>
            )}

            {/* Quick Stats Row */}
            <div className="flex gap-2">
                <div className="flex-1 text-center p-2 rounded-lg bg-white/5">
                    <div className="text-[10px] text-gray-500">Spent</div>
                    <div className="text-xs font-semibold text-gray-300 tabular-nums currency-value">
                        {formatCurrency(stats.myTotalShare)}
                    </div>
                </div>
                <div className="flex-1 text-center p-2 rounded-lg bg-white/5">
                    <div className="text-[10px] text-gray-500">Income</div>
                    <div className="text-xs font-semibold text-emerald-400 tabular-nums currency-value">
                        {formatCurrency(stats.monthlyIncome * 100)}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SidebarMetrics;

