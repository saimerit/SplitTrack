import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronLeft, ChevronRight, Loader2, CheckSquare, Trash2, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { deleteTransaction } from '../services/transactionService';
import { exportToCSV } from '../services/exportImportService';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Input from '../components/common/Input';
import TransactionItem from '../components/transactions/TransactionItem';
import SearchPalette from '../components/common/SearchPalette';
import ConfirmModal from '../components/modals/ConfirmModal';

const History = () => {
  const navigate = useNavigate();
  // Using client-side data from store for advanced pagination features
  const { transactions, participantsLookup, tags, showToast, loading: storeLoading } = useAppStore();

  // --- State ---
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Filters
  const [filterTag, setFilterTag] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');

  // UI State
  const [showSearch, setShowSearch] = useState(false);

  const [deleteData, setDeleteData] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);

  // --- Derived Data (Filtering & Sorting) ---
  const filteredData = useMemo(() => {
    // 1. Sort by Date Descending
    const sorted = [...transactions].sort((a, b) => {
      const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
      const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
      return tB - tA;
    });

    // 2. Apply Filters
    return sorted.filter(t => {
      if (t.isDeleted) return false;

      if (filterTag && t.tag !== filterTag) return false;

      if (filterDate) {
        const d = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        const dateStr = d.toISOString().split('T')[0];
        if (dateStr !== filterDate) return false;
      }

      if (filterMonth) {
        const d = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        const monthStr = d.toISOString().slice(0, 7); // YYYY-MM
        if (monthStr !== filterMonth) return false;
      }

      return true;
    });
  }, [transactions, filterTag, filterDate, filterMonth]);

  // --- Pagination Logic ---
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);

  // Reset to page 1 if filters change

  // Get current slice
  const currentTransactions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, currentPage, pageSize]);

  // --- Handlers ---
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of list smoothly
      document.getElementById('txn-list-top')?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const requestDelete = (id, parentId) => {
    // Check for linked children in the FULL dataset (not just current page)
    const hasChildren = transactions.some(t =>
      !t.isDeleted && (t.parentTransactionId === id || (t.parentTransactionIds && t.parentTransactionIds.includes(id)))
    );

    if (hasChildren) {
      showToast("Cannot delete: Has linked refunds/repayments.", true);
      return;
    }
    setDeleteData({ id, parentId });
  };

  const confirmDelete = async () => {
    if (!deleteData) return;
    try {
      await deleteTransaction(deleteData.id, deleteData.parentId);
      showToast("Transaction deleted.");
    } catch (error) {
      console.error(error);
      showToast("Failed to delete.", true);
    }
    setDeleteData(null);
  };

  // Keyboard shortcut for search
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

  const handleEdit = (txn) => navigate('/add', { state: { ...txn, isEditMode: true } });

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id) => {
    const newDocs = new Set(selectedIds);
    if (newDocs.has(id)) newDocs.delete(id);
    else newDocs.add(id);
    setSelectedIds(newDocs);
  };

  const handleBulkDelete = () => {
    setShowBulkConfirm(true);
  };

  const confirmBulkDelete = async () => {
    try {
      const promises = Array.from(selectedIds).map(id => deleteTransaction(id));
      await Promise.all(promises);
      showToast(`Deleted ${selectedIds.size} items`);
      setIsSelectionMode(false);
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      showToast("Error deleting items", true);
    }
    setShowBulkConfirm(false);
  };

  const handleClone = (txn) => {
    // Clone data but reset ID and Date
    const cloneData = {
      ...txn,
      id: null,
      timestamp: new Date().toISOString(), // Use simple string, Form will parse it
      isEditMode: false,
      linkedTransactions: [],
      splits: txn.splits || {}
    };
    navigate('/add', { state: cloneData });
  };

  // Generate page options for dropdown
  const pageOptions = Array.from({ length: totalPages }, (_, i) => ({ value: i + 1, label: `Page ${i + 1}` }));

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">History</h2>

        <div className="flex gap-3 w-full md:w-auto">
          <Button onClick={toggleSelectionMode} variant={isSelectionMode ? "primary" : "secondary"} className="flex-1 md:flex-none flex items-center justify-center gap-2">
            {isSelectionMode ? <X size={16} /> : <CheckSquare size={16} />} <span className="hidden sm:inline">{isSelectionMode ? 'Cancel' : 'Select'}</span>
          </Button>
          <button
            onClick={() => setShowSearch(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-sky-500 transition-colors"
          >
            <Search size={16} /> <span>Search</span>
            <span className="hidden sm:inline-block bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-xs border border-gray-200 dark:border-gray-600">⌘K</span>
          </button>
          <Button onClick={() => exportToCSV(filteredData, participantsLookup)} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700">
            <Download size={16} /> <span className="hidden sm:inline">Export View</span><span className="sm:hidden">Export</span>
          </Button>
        </div>
      </div>

      {/* --- Filter Bar --- */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border dark:border-gray-700 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Select label="Filter by Tag" value={filterTag} onChange={e => { setFilterTag(e.target.value); setCurrentPage(1); }} options={[{ value: '', label: 'All Tags' }, ...tags.map(t => ({ value: t.name, label: t.name }))]} />
          <Input label="Filter by Date" type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); setCurrentPage(1); }} />
          <Input label="Filter by Month" type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDate(''); setCurrentPage(1); }} />

          <Select
            label="Rows per page"
            value={pageSize}
            onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
            options={[
              { value: 10, label: '10 Rows' },
              { value: 20, label: '20 Rows' },
              { value: 50, label: '50 Rows' },
              { value: 100, label: '100 Rows' }
            ]}
          />
        </div>
        <div className="flex justify-end">
          <Button
            variant="secondary"
            onClick={() => { setFilterTag(''); setFilterDate(''); setFilterMonth(''); }}
            className="text-xs px-4"
          >
            Clear Filters
          </Button>
        </div>
      </div>

      {/* --- PAGINATION CONTROLS (Top) --- */}
      {totalPages > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            Showing <span className="font-bold">{((currentPage - 1) * pageSize) + 1}</span> - <span className="font-bold">{Math.min(currentPage * pageSize, totalItems)}</span> of <span className="font-bold">{totalItems}</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 h-9 w-9 flex items-center justify-center rounded-full"
            >
              <ChevronLeft size={16} />
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Page</span>
              <div className="relative">
                <select
                  value={currentPage}
                  onChange={(e) => handlePageChange(Number(e.target.value))}
                  className="appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 text-sm rounded-md focus:ring-sky-500 focus:border-sky-500 block w-20 p-1.5 pr-6 font-semibold text-center"
                >
                  {pageOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.value}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-gray-500">
                  <ChevronRight size={12} className="rotate-90" />
                </div>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">of {totalPages}</span>
            </div>

            <Button
              variant="secondary"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="p-2 h-9 w-9 flex items-center justify-center rounded-full"
            >
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {/* --- Transaction List --- */}
      <div id="txn-list-top" className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden min-h-[300px] relative">
        {storeLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10 backdrop-blur-sm">
            <Loader2 className="animate-spin text-sky-600" size={32} />
          </div>
        )}

        {currentTransactions.length === 0 && !storeLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center text-gray-500">
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-full mb-3">
              <Search size={24} className="opacity-50" />
            </div>
            <p>No transactions match your filters.</p>
          </div>
        ) : (
          Object.entries(
            currentTransactions.reduce((groups, txn) => {
              const d = txn.timestamp?.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp || 0);
              const dateKey = d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              if (!groups[dateKey]) groups[dateKey] = [];
              groups[dateKey].push(txn);
              return groups;
            }, {})
          ).map(([date, txns]) => (
            <div key={date} className="">
              <div className="sticky top-0 z-10 bg-gray-50/95 dark:bg-gray-800/95 backdrop-blur-sm px-4 py-2 border-b border-gray-100 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider shadow-sm flex items-center justify-between">
                <span>{date}</span>
                <span className="text-[10px] font-normal opacity-70">{txns.length} items</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {txns.map(txn => {
                  const linkedRefunds = transactions.filter(t =>
                    !t.isDeleted && (t.parentTransactionId === txn.id || (t.parentTransactionIds && t.parentTransactionIds.includes(txn.id)))
                  );
                  return (
                    <TransactionItem
                      key={txn.id}
                      txn={txn}
                      linkedRefunds={linkedRefunds}
                      participantsLookup={participantsLookup}
                      onEdit={() => handleEdit(txn)}
                      onDelete={requestDelete}
                      selectionMode={isSelectionMode}
                      isSelected={selectedIds.has(txn.id)}
                      onToggleSelect={toggleSelection}
                      onClone={handleClone}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* --- Pagination Controls (Bottom - Simple) --- */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          <span className="text-xs text-gray-400">Page {currentPage} of {totalPages}</span>
        </div>
      )}

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

      <ConfirmModal
        isOpen={showBulkConfirm}
        title={`Delete ${selectedIds.size} Transactions?`}
        message={`
          <div class="text-left max-h-60 overflow-y-auto space-y-2 mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
            ${Array.from(selectedIds).map(id => {
          const t = transactions.find(tx => tx.id === id);
          if (!t) return '';
          return `
                  <div class="flex justify-between border-b border-gray-200 dark:border-gray-600 pb-1 last:border-0">
                    <div>
                      <div class="font-medium text-gray-800 dark:text-gray-200">${t.expenseName}</div>
                      <div class="text-xs text-gray-500">${new Date(t.timestamp?.toDate ? t.timestamp.toDate() : t.timestamp).toLocaleDateString()}</div>
                    </div>
                    <div class="font-bold text-red-600">₹${t.amount}</div>
                  </div>
                `;
        }).join('')}
          </div>
          <p class="mt-4 text-red-500 font-semibold">This action cannot be undone.</p>
        `}
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkConfirm(false)}
        confirmText={`Delete ${selectedIds.size} Items`}
      />

      {/* Floating Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-6 py-3 rounded-full shadow-xl border border-gray-200 dark:border-gray-700 flex items-center gap-6 z-50 animate-slide-up">
          <span className="font-semibold text-sm whitespace-nowrap">{selectedIds.size} Selected</span>
          <div className="h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
          <button onClick={handleBulkDelete} className="flex items-center gap-2 text-red-600 hover:text-red-700 font-medium text-sm">
            <Trash2 size={16} /> Delete
          </button>
          <button onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false); }} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-sm">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default History;