import { useState, useMemo } from 'react';
import { useBalances } from '../hooks/useBalances';
import useAppStore from '../store/useAppStore';
import { Plus, Trash2, RotateCcw, Sparkles, User, Check } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import StatCard from '../components/common/StatCard';
import { formatCurrency } from '../utils/formatters';

const Sandbox = () => {
    const { transactions, participants, categories } = useAppStore();

    // Local State for "Phantom" Transactions
    const [sandboxTxns, setSandboxTxns] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        type: 'expense', // expense | income
        category: '',
        payer: 'me',
        beneficiaries: ['me'] // List of uniqueIds involved in the split
    });

    // 1. Calculate Real Stats
    const currentStats = useBalances(transactions, participants);

    // 2. Calculate Projected Stats (Real + Sandbox)
    const combinedTxns = useMemo(() => {
        const mappedSandbox = sandboxTxns.map(t => {
            let payer = t.payer || 'me';
            let splits = {};
            const amount = t.amount || 0;
            const beneficiaries = t.beneficiaries || ['me'];

            if (t.type === 'expense') {
                const count = beneficiaries.length;
                if (count > 0) {
                    // Precision handling: calculating share in paise integers
                    const share = Math.floor(amount / count);
                    let remainder = amount % count;

                    // Distribute equally
                    beneficiaries.forEach((id, index) => {
                        // Distribute remainder paise to first few to ensure total matches exactly
                        splits[id] = share + (index < remainder ? 1 : 0);
                    });
                } else {
                    // Fallback: Payer pays for themselves
                    splits[payer] = amount;
                }
            }

            return {
                ...t,
                payer,
                splits,
                isDeleted: false,
                timestamp: t.timestamp || new Date()
            };
        });
        return [...transactions, ...mappedSandbox];
    }, [transactions, sandboxTxns, participants]);

    const projectedStats = useBalances(combinedTxns, participants);

    // Handlers
    const handleAdd = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.amount) return;
        if (formData.beneficiaries.length === 0) {
            // Ideally show toast/error. For now just return.
            return;
        }

        const newTxn = {
            id: `sandbox-${Date.now()}`,
            expenseName: formData.name,
            amount: parseFloat(formData.amount) * 100, // Store in paise
            type: formData.type,
            category: formData.category || 'Sandbox',
            payer: formData.payer,
            beneficiaries: formData.beneficiaries,
            timestamp: new Date()
        };

        setSandboxTxns([...sandboxTxns, newTxn]);
        // Reset form but keep last payer settings for convenience
        setFormData({ ...formData, name: '', amount: '' });
    };

    const removeTxn = (id) => {
        setSandboxTxns(sandboxTxns.filter(t => t.id !== id));
    };

    const resetSandbox = () => setSandboxTxns([]);

    const toggleBeneficiary = (id) => {
        const current = formData.beneficiaries;
        if (current.includes(id)) {
            setFormData({ ...formData, beneficiaries: current.filter(b => b !== id) });
        } else {
            setFormData({ ...formData, beneficiaries: [...current, id] });
        }
    };

    return (
        <div className="space-y-8 pb-20 animate-fade-in max-w-6xl mx-auto">
            <div className="glass-card p-6 md:p-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 flex items-center gap-2">
                            <Sparkles className="text-purple-400" /> Sandbox Mode
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Simulate transactions to forecast your net position. These are <strong>not</strong> saved.
                        </p>
                    </div>
                    {sandboxTxns.length > 0 && (
                        <Button variant="secondary" onClick={resetSandbox} className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 gap-2">
                            <RotateCcw size={14} /> Reset Simulation
                        </Button>
                    )}
                </div>
            </div>

            {/* Comparison Cards using StatCard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
                <StatCard
                    title="Net Position"
                    value={currentStats.netPosition}
                    projectedValue={projectedStats.netPosition}
                    colorTheme="dynamic"
                    showDiff={true}
                />
                <StatCard
                    title="Total Expenditure"
                    value={currentStats.myTotalShare}
                    projectedValue={projectedStats.myTotalShare}
                    colorTheme="blue"
                    showDiff={true}
                />
                <StatCard
                    title="Month Income"
                    value={currentStats.monthlyIncome * 100}
                    projectedValue={projectedStats.monthlyIncome * 100}
                    colorTheme="emerald"
                    showDiff={true}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Simulator Form */}
                <div className="lg:col-span-1">
                    <div className="glass-card p-6 sticky top-24">
                        <h3 className="text-lg font-bold text-gray-200 mb-4">Add Simulation</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 rounded-lg mb-4">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                                    className={`py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'expense' ? 'bg-white/10 shadow text-white' : 'text-gray-400'}`}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income' })}
                                    className={`py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'income' ? 'bg-white/10 shadow text-white' : 'text-gray-400'}`}
                                >
                                    Income
                                </button>
                            </div>

                            <Input
                                placeholder="Description"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />

                            <Input
                                type="number"
                                placeholder="Amount"
                                value={formData.amount}
                                onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            />

                            {/* Expense Logic: Who Paid? Who is it for? */}
                            {formData.type === 'expense' && (
                                <div className="space-y-3">
                                    <Select
                                        label="Paid By"
                                        value={formData.payer}
                                        onChange={e => setFormData({ ...formData, payer: e.target.value })}
                                        options={[
                                            { value: 'me', label: 'Me' },
                                            ...participants
                                                .filter(p => p.uniqueId !== 'me')
                                                .map(p => ({ value: p.uniqueId, label: p.name.split(' ')[0] }))
                                        ]}
                                    />

                                    <div>
                                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Split With ({formData.beneficiaries.length})
                                        </label>
                                        <div className="flex flex-wrap gap-2">
                                            {/* Me Toggle */}
                                            <button
                                                type="button"
                                                onClick={() => toggleBeneficiary('me')}
                                                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${formData.beneficiaries.includes('me')
                                                    ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300'
                                                    : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                                                    }`}
                                            >
                                                {formData.beneficiaries.includes('me') && <Check size={12} />} You
                                            </button>

                                            {/* Other Participants */}
                                            {participants.filter(p => p.uniqueId !== 'me').map(p => (
                                                <button
                                                    key={p.uniqueId}
                                                    type="button"
                                                    onClick={() => toggleBeneficiary(p.uniqueId)}
                                                    className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${formData.beneficiaries.includes(p.uniqueId)
                                                        ? 'bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300'
                                                        : 'bg-gray-50 border-gray-200 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                                                        }`}
                                                >
                                                    {formData.beneficiaries.includes(p.uniqueId) && <Check size={12} />} {p.name.split(' ')[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Breakdown Summary */}
                                    {formData.amount && formData.beneficiaries.length > 0 && (
                                        <div className="text-xs bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700 mt-3 space-y-1">
                                            <div className="flex justify-between text-gray-500 dark:text-gray-400">
                                                <span>Total Amount:</span>
                                                <span>{formatCurrency(parseFloat(formData.amount) * 100)}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-500 dark:text-gray-400">
                                                <span>Split Between:</span>
                                                <span>{formData.beneficiaries.length} people</span>
                                            </div>
                                            <div className="flex justify-between font-medium pt-2 border-t border-gray-200 dark:border-gray-600 mt-2">
                                                <span className="text-gray-700 dark:text-gray-200">Your Share:</span>
                                                <span className={formData.beneficiaries.includes('me') ? "text-purple-600 dark:text-purple-400" : "text-gray-400"}>
                                                    {formData.beneficiaries.includes('me')
                                                        ? formatCurrency((parseFloat(formData.amount) * 100) / formData.beneficiaries.length)
                                                        : formatCurrency(0)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <Select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                options={[{ value: '', label: 'Category (Optional)' }, ...categories.map(c => ({ value: c.name, label: c.name }))]}
                            />

                            <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-purple-200 dark:shadow-none">
                                <Plus size={18} className="mr-2 inline" /> Add to Forecast
                            </Button>
                        </form>
                    </div>
                </div>

                {/* Simulator List */}
                <div className="lg:col-span-2">
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center">
                            <h3 className="font-bold text-gray-300">Sandbox Transactions</h3>
                            <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-1 rounded-full">
                                {sandboxTxns.length} Items
                            </span>
                        </div>

                        {sandboxTxns.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className="bg-purple-500/10 p-6 rounded-full mb-4">
                                    <Sparkles size={48} className="text-purple-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white">Start Simulating</h3>
                                <p className="text-gray-500 max-w-sm mt-1 mb-6">
                                    Add theoretical expenses or incomes to see how they impact your financial future.
                                </p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {sandboxTxns.map((t) => (
                                    <div key={t.id} className="p-4 flex justify-between items-center hover:bg-white/5 transition-colors animate-slide-in-right gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{t.expenseName}</p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {t.payer === 'me' ? 'You' : participants.find(p => p.uniqueId === t.payer)?.name} paid
                                                    {t.type === 'expense' && ` • Split w/ ${t.beneficiaries?.length || 1}`}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                                            <span className={`font-mono font-medium text-sm sm:text-base ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                                                {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                            </span>
                                            <button
                                                onClick={() => removeTxn(t.id)}
                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sandbox;
