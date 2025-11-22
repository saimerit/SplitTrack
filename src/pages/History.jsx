import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { deleteTransaction } from '../services/transactionService';
import { exportToCSV } from '../services/exportImportService';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Input from '../components/common/Input';
import TransactionItem from '../components/transactions/TransactionItem';

const History = () => {
  const navigate = useNavigate();
  const { transactions, participantsLookup, tags, showToast } = useAppStore();
  
  const [filterTag, setFilterTag] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterTag && t.tag !== filterTag) return false;
      if (filterDate) {
        const d = t.timestamp.toDate().toISOString().split('T')[0];
        if (d !== filterDate) return false;
      } 
      else if (filterMonth) {
        const d = t.timestamp.toDate();
        const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (m !== filterMonth) return false;
      }
      return true;
    });
  }, [transactions, filterTag, filterDate, filterMonth]);

  const handleDelete = async (id, parentId) => {
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
    // Pass the full transaction object to the Add form
    navigate('/add', { state: { ...txn, isEditMode: true } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">History</h2>
        <Button onClick={() => exportToCSV(transactions, participantsLookup)} className="flex items-center gap-2 bg-green-600 hover:bg-green-700">
          <Download size={16} /> Export CSV
        </Button>
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
            // FIX: Find children that link to THIS transaction (either single or multi-link)
            const linkedRefunds = transactions.filter(t => {
                // Check legacy single link
                if (t.parentTransactionId === txn.id) return true;
                // Check new multi-link array
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
    </div>
  );
};

export default History;