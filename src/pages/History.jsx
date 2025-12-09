import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { deleteTransaction, fetchPaginatedTransactions } from '../services/transactionService';
import { exportToCSV } from '../services/exportImportService';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Input from '../components/common/Input';
import TransactionItem from '../components/transactions/TransactionItem';
import SearchPalette from '../components/common/SearchPalette';
import ConfirmModal from '../components/modals/ConfirmModal';

const History = () => {
  const navigate = useNavigate();
  // Only pull aux data from store now
  const { participantsLookup, tags, showToast } = useAppStore();

  // --- Local State for Pagination & Data ---
  const [localTransactions, setLocalTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Pagination State
  const [pageSize, setPageSize] = useState(10);
  const [pageStack, setPageStack] = useState([]); // Stack of 'lastDoc' cursors
  const [currentLastDoc, setCurrentLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [filterTag, setFilterTag] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // UI State
  const [showSearch, setShowSearch] = useState(false);
  const [deleteData, setDeleteData] = useState(null);

  // --- Fetch Logic ---
  const loadTransactions = async (reset = false) => {
    setLoading(true);
    try {
      const cursor = reset ? null : currentLastDoc;
      const result = await fetchPaginatedTransactions(
        Number(pageSize),
        cursor,
        { tag: filterTag, date: filterDate, month: filterMonth }
      );

      if (reset) {
        setLocalTransactions(result.data);
        setPageStack([]);
      } else {
        setLocalTransactions(result.data);
      }

      setCurrentLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error(error);
      showToast("Error loading history", true);
    } finally {
      setLoading(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    loadTransactions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, filterTag, filterDate, filterMonth]);

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

  // --- Handlers ---
  const handleNextPage = () => {
    if (!currentLastDoc) return;
    setPageStack(prev => [...prev, currentLastDoc]);
    loadTransactions(false);
  };

  const handlePrevPage = async () => {
    if (pageStack.length === 0) return;
    const newStack = [...pageStack];
    newStack.pop(); 
    const prevCursor = newStack.length > 0 ? newStack[newStack.length - 1] : null;
    setPageStack(newStack);

    setLoading(true);
    try {
      const result = await fetchPaginatedTransactions(
        Number(pageSize),
        prevCursor,
        { tag: filterTag, date: filterDate, month: filterMonth }
      );
      setLocalTransactions(result.data);
      setCurrentLastDoc(result.lastDoc);
      setHasMore(result.hasMore);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (id, parentId) => {
    const hasChildren = localTransactions.some(t =>
      t.parentTransactionId === id || (t.parentTransactionIds && t.parentTransactionIds.includes(id))
    );
    if (hasChildren) {
      showToast("Cannot delete: Has linked refunds/repayments visible on this page.", true);
      return;
    }
    setDeleteData({ id, parentId });
  };

  const confirmDelete = async () => {
    if (!deleteData) return;
    try {
      await deleteTransaction(deleteData.id, deleteData.parentId);
      setLocalTransactions(prev => prev.filter(t => t.id !== deleteData.id));
      showToast("Transaction deleted.");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete.", true);
    }
    setDeleteData(null);
  };

  const handleEdit = (txn) => navigate('/add', { state: { ...txn, isEditMode: true } });

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">History</h2>

        <div className="flex gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowSearch(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-sky-500 transition-colors"
          >
            <Search size={16} /> <span>Search</span>
            <span className="hidden sm:inline-block bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-xs border border-gray-200 dark:border-gray-600">⌘K</span>
          </button>
          <Button onClick={() => exportToCSV(localTransactions, participantsLookup)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700">
            <Download size={16} /> <span className="hidden sm:inline">Export View</span><span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* --- Filter Bar --- */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select label="Filter by Tag" value={filterTag} onChange={e => setFilterTag(e.target.value)} options={[{ value: '', label: 'All Tags' }, ...tags.map(t => ({ value: t.name, label: t.name }))]} />
          <Input label="Filter by Date" type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); }} />
          <Input label="Filter by Month" type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDate(''); }} />
          <Select
            label="Rows per page"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            options={[
              { value: 10, label: '10 Rows' },
              { value: 20, label: '20 Rows' },
              { value: 50, label: '50 Rows' },
              { value: 100, label: '100 Rows' }
            ]}
          />
        </div>
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => { setFilterTag(''); setFilterDate(''); setFilterMonth(''); }} className="text-xs px-4">
            Clear Filters
          </Button>
        </div>
      </div>

      {/* --- Transaction List --- */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden min-h-[300px] relative">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10 backdrop-blur-sm">
            <Loader2 className="animate-spin text-sky-600" size={32} />
          </div>
        )}

        {localTransactions.length === 0 && !loading ? (
          <div className="p-8 text-center text-gray-500">No transactions found.</div>
        ) : (
          localTransactions.map(txn => {
            const linkedRefunds = localTransactions.filter(t =>
              t.parentTransactionId === txn.id || (t.parentTransactionIds && t.parentTransactionIds.includes(txn.id))
            );

            return (
              <TransactionItem
                key={txn.id}
                txn={txn}
                linkedRefunds={linkedRefunds}
                participantsLookup={participantsLookup}
                onEdit={() => handleEdit(txn)}
                onDelete={requestDelete}
              />
            );
          })
        )}
      </div>

      {/* --- Pagination Controls --- */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700">
        <Button variant="secondary" onClick={handlePrevPage} disabled={pageStack.length === 0 || loading} className="flex items-center gap-2 text-sm px-3">
          <ChevronLeft size={16} /> <span className="hidden sm:inline">Previous</span>
        </Button>

        <span className="text-sm text-gray-500 dark:text-gray-400">
          Page {pageStack.length + 1}
        </span>

        <Button variant="secondary" onClick={handleNextPage} disabled={!hasMore || loading} className="flex items-center gap-2 text-sm px-3">
          <span className="hidden sm:inline">Next</span> <ChevronRight size={16} />
        </Button>
      </div>

      {showSearch && <SearchPalette onClose={() => setShowSearch(false)} />}

      <ConfirmModal
        isOpen={!!deleteData}
        title="Delete Transaction?"
        message="Are you sure you want to delete this transaction?"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteData(null)}
        confirmText="Delete"
        confirmInputRequired={null}
      />
    </div>
  );
};

export default History;