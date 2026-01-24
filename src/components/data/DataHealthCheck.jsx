import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, AlertTriangle, CheckCircle, Link2Off, Folder, CreditCard, TrendingDown, Filter, RefreshCw, ShieldAlert } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { runDataHealthScan } from '../../utils/applySmartRules';
import { repairAllTransactionStats } from '../../services/transactionService';
import Button from '../common/Button';

const DataHealthCheck = () => {
    const navigate = useNavigate();
    const { transactions, participants, showToast } = useAppStore();
    const [hasScanned, setHasScanned] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isRepairing, setIsRepairing] = useState(false);

    const handleRepair = async () => {
        if (!window.confirm("This will overwrite settlement statuses for all transactions based on current links. Proceed?")) return;

        setIsRepairing(true);
        try {
            const { processed } = await repairAllTransactionStats();
            showToast(`Success! Recalibrated ${processed} transactions.`);
            // Refresh the health scan
            handleScan();
        } catch (err) {
            showToast("Repair failed. Check console for details.", true);
            console.error(err);
        } finally {
            setIsRepairing(false);
        }
    };

    const healthReport = useMemo(() => {
        if (!hasScanned) return null;
        return runDataHealthScan(transactions, participants);
    }, [transactions, participants, hasScanned]);

    const handleScan = () => {
        setLoading(true);
        setTimeout(() => {
            setHasScanned(true);
            setLoading(false);
            if (runDataHealthScan(transactions, participants).total === 0) {
                showToast('All systems nominal. No issues found!');
            }
        }, 500);
    };

    const handleFilterAndFix = (issueType) => {
        // Navigate to History with a special filter based on issue type
        // For now, just navigate to History - can be enhanced with query params
        navigate('/history', { state: { filterIssue: issueType } });
        showToast(`Filtering ${issueType} issues in History...`);
    };

    const IssueCard = ({ icon: Icon, title, color, issues, issueType }) => (
        <div className={`p-4 rounded-xl border ${issues.length > 0 ? `bg-${color}-500/5 border-${color}-500/20` : 'bg-white/5 border-white/5'}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Icon size={18} className={issues.length > 0 ? `text-${color}-400` : 'text-gray-500'} />
                    <h4 className="font-medium text-gray-200">{title}</h4>
                </div>
                <span className={`text-sm font-bold ${issues.length > 0 ? `text-${color}-400` : 'text-emerald-400'}`}>
                    {issues.length}
                </span>
            </div>

            {issues.length > 0 && (
                <>
                    <div className="max-h-20 overflow-y-auto space-y-1 mb-3">
                        {issues.slice(0, 3).map((issue, idx) => (
                            <p key={idx} className="text-xs text-gray-400 truncate">
                                • {issue.name || 'Unnamed'} {issue.issue ? `(${issue.issue})` : ''}
                            </p>
                        ))}
                        {issues.length > 3 && (
                            <p className="text-xs text-gray-500">...and {issues.length - 3} more</p>
                        )}
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleFilterAndFix(issueType)}
                        className="w-full text-xs"
                    >
                        <Filter size={12} className="mr-1" /> Filter & Fix
                    </Button>
                </>
            )}

            {issues.length === 0 && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                    <CheckCircle size={12} className="text-emerald-400" /> All clear
                </p>
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-200">Data Health Check</h3>
                        <p className="text-xs text-gray-500">Identify inconsistencies in your transaction data</p>
                    </div>
                </div>
                <Button
                    onClick={handleScan}
                    disabled={loading}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-500 border-none"
                >
                    {loading ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Scanning...
                        </>
                    ) : (
                        <>
                            <ShieldCheck size={16} /> Run Scan
                        </>
                    )}
                </Button>
            </div>

            {/* Data Repair Tool */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl mt-6">
                <div className="flex items-center gap-3 mb-4">
                    <ShieldAlert className="text-amber-400" size={24} />
                    <div>
                        <h4 className="font-bold text-gray-200">Data Repair Tool</h4>
                        <p className="text-xs text-gray-400">Forces a recalculation of all settlement statuses. Use this if your balances look "stuck".</p>
                    </div>
                </div>
                {/* Logic: Button is LOCKED if we haven't scanned yet OR if the scan results are perfectly clean */}
                {(() => {
                    const isLocked = !hasScanned || (healthReport && healthReport.total === 0);
                    return (
                        <Button
                            variant="secondary"
                            onClick={handleRepair}
                            disabled={isRepairing || isLocked}
                            className={`w-full ${isLocked ? 'opacity-50 cursor-not-allowed' : 'bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 border-amber-500/30'}`}
                        >
                            {isRepairing ? <RefreshCw className="animate-spin mr-2" size={16} /> : <RefreshCw className="mr-2" size={16} />}
                            {isRepairing ? "Repairing Data..." : isLocked ? "Repair Tool Locked (No Issues)" : "Run Deep Recalibration"}
                        </Button>
                    );
                })()}
            </div>

            {/* Results */}
            {!hasScanned ? (
                <div className="text-center py-12 text-gray-500">
                    <ShieldCheck size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Click "Run Scan" to check your data health</p>
                    <p className="text-xs mt-1">This will analyze all {transactions.filter(t => !t.isDeleted).length} transactions</p>
                </div>
            ) : healthReport ? (
                <>
                    {/* Summary */}
                    <div className={`p-4 rounded-xl flex items-center gap-4 ${healthReport.total === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-amber-500/10 border-amber-500/20'} border`}>
                        {healthReport.total === 0 ? (
                            <CheckCircle size={24} className="text-emerald-400" />
                        ) : (
                            <AlertTriangle size={24} className="text-amber-400" />
                        )}
                        <div>
                            <p className="font-bold text-gray-200">
                                {healthReport.total === 0 ? 'All Systems Nominal' : `${healthReport.total} Issues Found`}
                            </p>
                            <p className="text-xs text-gray-400">
                                {healthReport.total === 0
                                    ? 'Your transaction data is healthy and consistent.'
                                    : 'Review and fix the issues below to maintain data integrity.'}
                            </p>
                        </div>
                    </div>

                    {/* Issue Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <IssueCard
                            icon={Link2Off}
                            title="Orphaned Refunds"
                            color="red"
                            issues={healthReport.orphanedRefunds}
                            issueType="orphaned"
                        />
                        <IssueCard
                            icon={Folder}
                            title="Missing Category"
                            color="amber"
                            issues={healthReport.missingCategory}
                            issueType="missing-category"
                        />
                        <IssueCard
                            icon={CreditCard}
                            title="Missing Payment Mode"
                            color="blue"
                            issues={healthReport.missingPaymentMode}
                            issueType="missing-mode"
                        />
                        <IssueCard
                            icon={TrendingDown}
                            title="Invalid Amounts"
                            color="purple"
                            issues={healthReport.invalidAmounts}
                            issueType="invalid-amounts"
                        />
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default DataHealthCheck;
