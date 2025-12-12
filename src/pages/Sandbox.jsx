import { useState, useMemo } from 'react';
import { useBalances } from '../hooks/useBalances';
import useAppStore from '../store/useAppStore';
import { Plus, Trash2, RotateCcw, Sparkles } from 'lucide-react';
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
        splitType: 'me' // 'me' | 'them' | 'equal'
    });

    // 1. Calculate Real Stats
    const currentStats = useBalances(transactions, participants);

    // 2. Calculate Projected Stats (Real + Sandbox)
    const combinedTxns = useMemo(() => {
        const mappedSandbox = sandboxTxns.map(t => {
            let payer = t.payer || 'me';
            let splits = {};
            const amount = t.amount || 0;

            if (t.type === 'expense') {
                if (t.splitType === 'me') {
                    // For Me: Only I am involved in the split (assumes payer is Me, or Someone paid for Me)
                    // If payer is Me -> I paid for Me.
                    // If payer is Other -> They paid for Me.
                    splits = { 'me': amount };
                } else if (t.splitType === 'others') {
                    // I paid for someone else.
                    if (payer === 'me') {
                        // Paid for "Others". Default to first non-me participant for now to trigger debt.
                        const other = participants.find(p => p.uniqueId !== 'me');
                        if (other) splits = { [other.uniqueId]: amount };
                    } else {
                        // Someone else paid for someone else? Irrelevant for my net position usually, unless I'm involved.
                        // Ignore for simplicity.
                    }
                } else if (t.splitType === 'equal') {
                    // Split Equally among ALL participants
                    const partCount = participants.length;
                    const share = Math.floor(amount / partCount);
                    participants.forEach(p => splits[p.uniqueId] = share);
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

        const newTxn = {
            id: `sandbox-${Date.now()}`,
            expenseName: formData.name,
            amount: parseFloat(formData.amount) * 100, // Store in paise
            type: formData.type,
            category: formData.category || 'Sandbox',
            payer: formData.payer,
            splitType: formData.splitType,
            timestamp: new Date()
        };

        setSandboxTxns([...sandboxTxns, newTxn]);
        // Reset form but keep last payer/split settings for convenience
        setFormData({ ...formData, name: '', amount: '' });
    };

    const removeTxn = (id) => {
        setSandboxTxns(sandboxTxns.filter(t => t.id !== id));
    };

    const resetSandbox = () => setSandboxTxns([]);

    return (
        <div className="space-y-8 pb-20 animate-fade-in max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        <Sparkles className="text-purple-500" /> Sandbox Mode
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Simulate transactions to forecast your net position. These are <strong>not</strong> saved.
                    </p>
                </div>
                {sandboxTxns.length > 0 && (
                    <Button variant="secondary" onClick={resetSandbox} className="text-xs">
                        <RotateCcw size={14} className="mr-1" /> Reset Simulation
                    </Button>
                )}
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
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-purple-100 dark:border-gray-700 sticky top-24">
                        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4">Add Simulation</h3>
                        <form onSubmit={handleAdd} className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'expense' })}
                                    className={`py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'expense' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
                                >
                                    Expense
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, type: 'income' })}
                                    className={`py-2 text-sm font-medium rounded-md transition-all ${formData.type === 'income' ? 'bg-white dark:bg-gray-600 shadow text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
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

                            <div className="grid grid-cols-2 gap-3">
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

                                {formData.type === 'expense' && formData.payer === 'me' && (
                                    <Select
                                        label="For Whom?"
                                        value={formData.splitType}
                                        onChange={e => setFormData({ ...formData, splitType: e.target.value })}
                                        options={[
                                            { value: 'me', label: 'For Me' },
                                            { value: 'others', label: 'For Others (Lend)' }, // Simplification: "For Others" assigns to first Friend? Or we should allow picking?
                                            { value: 'equal', label: 'Split Equally' }
                                        ]}
                                    />
                                )}
                            </div>

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
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800">
                            <h3 className="font-bold text-gray-700 dark:text-gray-300">Sandbox Transactions</h3>
                            <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 px-2 py-1 rounded-full">
                                {sandboxTxns.length} Items
                            </span>
                        </div>

                        {sandboxTxns.length === 0 ? (
                            <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                                <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                    <Sparkles size={24} className="text-gray-400" />
                                </div>
                                <p>No active simulations.</p>
                                <p className="text-sm mt-1">Add items on the left to predict your future balance.</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                                {sandboxTxns.map((t) => (
                                    <div key={t.id} className="p-4 flex justify-between items-center bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-colors animate-slide-in-right gap-3">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.type === 'income' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-800 dark:text-gray-200 truncate">{t.expenseName}</p>
                                                <p className="text-xs text-gray-500 truncate">
                                                    {t.payer === 'me' ? 'You' : participants.find(p => p.uniqueId === t.payer)?.name}
                                                    {t.type === 'expense' && ` • ${t.splitType === 'others' ? 'Lent' : t.category}`}
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
