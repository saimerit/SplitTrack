import { useMemo } from 'react';
import { ArrowRight, Sparkles, Users, Zap } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

/**
 * SmartSettle - Calculates optimal debt settlement paths
 * Shows "Instead of A→B→C, do A→C directly" suggestions
 */
const SmartSettle = ({ balances = {}, participants = [], onSettle }) => {
    // Calculate optimized settlements
    const settlements = useMemo(() => {
        if (!balances || Object.keys(balances).length === 0) {
            return [];
        }

        // Separate creditors (positive balance) and debtors (negative balance)
        const creditors = [];
        const debtors = [];

        Object.entries(balances).forEach(([uid, amount]) => {
            if (amount > 100) { // More than ₹1 threshold
                creditors.push({ uid, amount });
            } else if (amount < -100) {
                debtors.push({ uid, amount: Math.abs(amount) });
            }
        });

        // Sort by amount (largest first for optimal matching)
        creditors.sort((a, b) => b.amount - a.amount);
        debtors.sort((a, b) => b.amount - a.amount);

        // Generate optimal settlements
        const suggestedSettlements = [];
        const usedCreditors = new Set();
        const usedDebtors = new Set();

        // Match debtors to creditors optimally
        debtors.forEach((debtor) => {
            if (usedDebtors.has(debtor.uid)) return;

            // Find best matching creditor
            for (const creditor of creditors) {
                if (usedCreditors.has(creditor.uid)) continue;

                const settleAmount = Math.min(debtor.amount, creditor.amount);

                if (settleAmount > 100) {
                    const debtorInfo = participants.find(p => p.uniqueId === debtor.uid);
                    const creditorInfo = participants.find(p => p.uniqueId === creditor.uid);

                    suggestedSettlements.push({
                        from: debtor.uid,
                        fromName: debtorInfo?.name || debtor.uid,
                        to: creditor.uid,
                        toName: creditorInfo?.name || creditor.uid,
                        amount: settleAmount
                    });

                    // Mark as used if fully settled
                    if (settleAmount >= debtor.amount) usedDebtors.add(debtor.uid);
                    if (settleAmount >= creditor.amount) usedCreditors.add(creditor.uid);

                    break;
                }
            }
        });

        return suggestedSettlements;
    }, [balances, participants]);

    if (settlements.length === 0) {
        return null;
    }

    return (
        <div className="glass-card p-4 space-y-4">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                    <Zap size={16} className="text-white" />
                </div>
                <div>
                    <h3 className="text-sm font-semibold text-gray-300">Smart Settle</h3>
                    <p className="text-[10px] text-gray-500">Optimized payment suggestions</p>
                </div>
            </div>

            <div className="space-y-2">
                {settlements.slice(0, 3).map((settlement, idx) => (
                    <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10 hover:border-emerald-500/30 transition-colors"
                    >
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-400">You</span>
                            <ArrowRight size={14} className="text-emerald-400" />
                            <span className="text-gray-200 font-medium">{settlement.toName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-emerald-400 font-semibold tabular-nums">
                                {formatCurrency(settlement.amount)}
                            </span>
                            {onSettle && (
                                <button
                                    onClick={() => onSettle(settlement.to, settlement.amount)}
                                    className="px-3 py-1.5 text-xs font-medium bg-emerald-500/20 text-emerald-400 rounded-full hover:bg-emerald-500/30 transition-colors haptic-tap"
                                >
                                    Settle
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {settlements.length > 3 && (
                <p className="text-[10px] text-gray-500 text-center">
                    +{settlements.length - 3} more suggestions
                </p>
            )}
        </div>
    );
};

export default SmartSettle;
