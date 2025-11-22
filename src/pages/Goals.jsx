import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { addDoc, deleteDoc, doc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/common/Button';
import PromptModal from '../components/modals/PromptModal';
import ConfirmModal from '../components/modals/ConfirmModal';

const Goals = () => {
  const { transactions, goals, showToast } = useAppStore();

  // --- Modal State ---
  const [promptStep, setPromptStep] = useState(null); // 'name' | 'target' | null
  const [tempGoalName, setTempGoalName] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const currentSavings = useMemo(() => {
    let income = 0;
    let expense = 0;

    transactions.forEach(t => {
        const val = t.amount / 100;
        if (t.type === 'income') {
            income += val;
        } 
        else if (!t.isReturn && t.type !== 'refund') {
            let myShare = val;
            if (t.splits && t.splits.me !== undefined) {
                myShare = t.splits.me / 100;
            }
            expense += myShare;
        } 
        else if (t.amount < 0) {
            if (t.payer === 'me') expense += val; 
        }
    });

    return income - expense;
  }, [transactions]);

  // Step 1: Start Add Goal
  const startAddGoal = () => {
    setTempGoalName('');
    setPromptStep('name');
  };

  // Step 2: Handle Name Submit -> Show Target Prompt
  const handleNameSubmit = (name) => {
    setTempGoalName(name);
    setPromptStep('target');
  };

  // Step 3: Handle Target Submit -> Save to Firebase
  const handleTargetSubmit = async (targetStr) => {
    setPromptStep(null);
    const target = parseFloat(targetStr);
    
    if (target && target > 0) {
        try {
            await addDoc(collection(db, 'ledgers/main-ledger/goals'), { name: tempGoalName, target });
            showToast("Goal added!");
        } catch {
            showToast("Failed to add goal.", true);
        }
    } else {
        showToast("Invalid target amount.", true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
        await deleteDoc(doc(db, 'ledgers/main-ledger/goals', deleteId));
        showToast("Goal deleted.");
    } catch {
        showToast("Failed to delete.", true);
    }
    setDeleteId(null);
  };

  const totalTarget = goals.reduce((sum, g) => sum + (g.target || 0), 0);
  const globalPercent = totalTarget > 0 ? Math.min(100, (currentSavings / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Savings Goals</h2>
        <Button onClick={startAddGoal} className="flex items-center gap-2">
            <Plus size={18} /> New Goal
        </Button>
      </div>

      {/* Global Savings Card */}
      <div className="bg-linear-to-r from-green-500 to-emerald-600 rounded-lg shadow-lg p-6 text-white">
        <h3 className="text-lg font-medium opacity-90">Total Savings (Income - Expenses)</h3>
        <div className="text-4xl font-bold mt-2">{formatCurrency(currentSavings * 100)}</div>
        <div className="mt-4 w-full bg-white/20 rounded-full h-2">
            <div className="bg-white h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.max(0, globalPercent)}%` }}></div>
        </div>
        <p className="text-xs mt-2 opacity-80">Progress towards all combined targets</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map(g => {
            const percent = Math.min(100, Math.max(0, (currentSavings / g.target) * 100));
            
            return (
                <div key={g.id} className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 relative group">
                    <div className="flex justify-between mb-2">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200">{g.name}</h3>
                        <button 
                            onClick={() => setDeleteId(g.id)} 
                            className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">Target: {formatCurrency(g.target * 100)}</p>
                    
                    <div className="w-full bg-gray-200 rounded-full h-3 dark:bg-gray-700 mb-2 overflow-hidden">
                        <div className="bg-sky-600 h-3 rounded-full transition-all duration-1000 ease-out" style={{ width: `${percent}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">{formatCurrency(currentSavings * 100)} saved</span>
                        <span className="text-sky-600 dark:text-sky-400 font-bold">{Math.round(percent)}%</span>
                    </div>
                </div>
            );
        })}
        
        <div 
            onClick={startAddGoal}
            className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-sky-500 hover:bg-sky-50 dark:hover:bg-gray-800 transition"
        >
            <span className="text-3xl text-gray-400 mb-2">+</span>
            <span className="text-sm font-medium text-gray-500">Create Goal</span>
        </div>
      </div>

      {/* --- MODALS --- */}
      <PromptModal 
        isOpen={promptStep === 'name'}
        title="New Savings Goal"
        label="Goal Name"
        placeholder="e.g. New Car"
        onConfirm={handleNameSubmit}
        onCancel={() => setPromptStep(null)}
        confirmText="Next"
      />

      <PromptModal 
        isOpen={promptStep === 'target'}
        title={`Target for "${tempGoalName}"`}
        label="Target Amount (₹)"
        placeholder="e.g. 50000"
        inputType="number"
        onConfirm={handleTargetSubmit}
        onCancel={() => setPromptStep(null)}
        confirmText="Save Goal"
      />

      <ConfirmModal 
        isOpen={!!deleteId}
        title="Delete Goal?"
        message="Are you sure you want to delete this savings goal?"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete"
      />
    </div>
  );
};

export default Goals;