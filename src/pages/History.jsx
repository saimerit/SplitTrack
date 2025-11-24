import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search } from 'lucide-react'; // Added Search icon
import useAppStore from '../store/useAppStore';
import { deleteTransaction } from '../services/transactionService';
import { exportToCSV } from '../services/exportImportService';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Input from '../components/common/Input';
import TransactionItem from '../components/transactions/TransactionItem';
import SearchPalette from '../components/common/SearchPalette'; // Imported SearchPalette

const History = () => {
  const navigate = useNavigate();
  const { transactions, participantsLookup, tags, showToast } = useAppStore();
  
  const [filterTag, setFilterTag] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [showSearch, setShowSearch] = useState(false); // State for Search Modal

  // --- Keyboard Shortcut for Search (Only active on History page) ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterTag && t.tag !== filterTag) return false;

      let dObj;
      try {
        if (!t.timestamp) return false;
        dObj = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
      } catch {
        return false;
      }
      if (isNaN(dObj.getTime())) return false;

      if (filterDate) {
        const dStr = dObj.toISOString().split('T')[0];
        if (dStr !== filterDate) return false;
      } 
      else if (filterMonth) {
        const m = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}`;
        if (m !== filterMonth) return false;
      }
      return true;
    });
  }, [transactions, filterTag, filterDate, filterMonth]);

  const handleDelete = async (id, parentId) => {
    const hasChildren = transactions.some(t => 
      t.parentTransactionId === id || 
      (t.parentTransactionIds && t.parentTransactionIds.includes(id))
    );

    if (hasChildren) {
      alert("Cannot delete: This transaction has linked refunds/repayments. Please delete them first.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteTransaction(id, parentId);
        showToast("Transaction deleted.");
      } catch (error) {
        console.error(error);
        showToast("Failed to delete.", true);
      }
    }
  };

  const handleEdit = (txn) => {
    navigate('/add', { state: { ...txn, isEditMode: true } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">History</h2>
        
        <div className="flex gap-3">
            {/* Search Button */}
            <button 
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-sky-500 transition-colors"
            >
                <Search size={16} /> 
                <span>Search</span>
                <span className="hidden sm:inline-block bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-xs border border-gray-200 dark:border-gray-600">⌘K</span>
            </button>

            <Button onClick={() => exportToCSV(transactions, participantsLookup)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
                <Download size={16} /> Export CSV
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <Select label="Filter by Tag" value={filterTag} onChange={e => setFilterTag(e.target.value)} options={[{ value: '', label: 'All Tags' }, ...tags.map(t => ({ value: t.name, label: t.name }))]} />
        <Input label="Filter by Date" type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); }} />
        <Input label="Filter by Month" type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDate(''); }} />
        <div className="flex items-end">
          <Button 
            variant="secondary" 
            onClick={() => { setFilterTag(''); setFilterDate(''); setFilterMonth(''); }} 
            className="w-auto px-6 py-2 text-sm" 
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No transactions found.</div>
        ) : (
          filteredTransactions.map(txn => {
            const linkedRefunds = transactions.filter(t => {
                if (t.parentTransactionId === txn.id) return true;
                if (t.parentTransactionIds && t.parentTransactionIds.includes(txn.id)) return true;
                return false;
            });

            return (
                <TransactionItem 
                  key={txn.id} 
                  txn={txn}
                  linkedRefunds={linkedRefunds}
                  participantsLookup={participantsLookup}
                  onEdit={() => handleEdit(txn)}
                  onDelete={handleDelete}
                />
            );
          })
        )}
      </div>

      {/* Render Search Palette Modal */}
      {showSearch && <SearchPalette onClose={() => setShowSearch(false)} />}
    </div>
  );
};

export default History;