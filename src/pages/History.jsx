import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Search, ChevronLeft, ChevronRight, Loader2, CheckSquare, Trash2, X, Filter, Edit2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { deleteTransaction } from '../services/transactionService';
import { exportToCSV } from '../services/exportImportService';
import Button from '../components/common/Button';
import Select from '../components/common/Select';
import Input from '../components/common/Input';
import TransactionItem from '../components/transactions/TransactionItem';
import SearchPalette from '../components/common/SearchPalette';
import ConfirmModal from '../components/modals/ConfirmModal';
import BulkEditModal from '../components/modals/BulkEditModal';

const History = () => {
  const navigate = useNavigate();
  const { transactions, rawTransactions, participantsLookup, tags, showToast, loading: storeLoading } = useAppStore();
  const [filterTag, setFilterTag] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showSearch, setShowSearch] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleteData, setDeleteData] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');

  // Reset to page 1 if data changes significantly
  useEffect(() => {
    setCurrentPage(1);
  }, [transactions.length, filterTag, filterDate, filterMonth, localSearchQuery]);

  // Filter & Sort Logic
  // Sort transactions by timestamp desc
  const sortedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [transactions]);

  // Apply filters and local search
  const filteredData = useMemo(() => {
    return sortedTransactions.filter(txn => {
      if (txn.isDeleted) return false;
      if (filterTag && txn.tag !== filterTag) return false;

      // Local search filter
      if (localSearchQuery) {
        const query = localSearchQuery.toLowerCase();
        const matchesName = txn.expenseName?.toLowerCase().includes(query);
        const matchesCategory = txn.category?.toLowerCase().includes(query);
        const matchesTag = txn.tag?.toLowerCase().includes(query);
        const matchesPlace = txn.place?.toLowerCase().includes(query);
        if (!matchesName && !matchesCategory && !matchesTag && !matchesPlace) return false;
      }

      // For date filters
      const txnDate = new Date(txn.timestamp);
      if (filterDate) {
        const selectedDate = new Date(filterDate);
        if (txnDate.toDateString() !== selectedDate.toDateString()) return false;
      }
      if (filterMonth) {
        // filterMonth is "YYYY-MM"
        const [year, month] = filterMonth.split('-');
        if (txnDate.getFullYear() !== parseInt(year) || (txnDate.getMonth() + 1) !== parseInt(month)) return false;
      }
      return true;
    });
  }, [sortedTransactions, filterTag, filterDate, filterMonth, localSearchQuery]);

  // Pagination
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const currentTransactions = filteredData.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const hasMoreHistory = currentPage < totalPages; // Or similar flag depending on remote loading

  // Group By Date
  const groupedData = useMemo(() => {
    const groups = {};
    currentTransactions.forEach(txn => {
      // Handle both Firestore Timestamp and standard Date objects
      const timestamp = txn.timestamp;
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      const dateStr = isNaN(date.getTime()) ? 'Invalid Date' : date.toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      });
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(txn);
    });
    return groups;
  }, [currentTransactions]);

  // Action Handlers
  const handleEdit = (txn) => navigate('/add', { state: { ...txn, isEditMode: true } });
  const handleClone = (txn) => {
    // Clone: remove id so it creates new, and reset timestamp to today
    const { id, ...cloneData } = txn;
    navigate('/add', { state: { ...cloneData, isEditMode: false } });
  };
  const requestDelete = (id, parentId) => setDeleteData({ id, parentId });

  const confirmDelete = async () => {
    if (!deleteData) return;
    const { id, parentId } = deleteData;

    // Close modal immediately to prevent stuck state
    setDeleteData(null);

    try {
      await deleteTransaction(id, parentId);
      showToast('Transaction deleted successfully!');
    } catch (err) {
      console.error('Delete error:', err);
      // Error toast is already shown by deleteTransaction
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedIds(new Set());
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkDelete = () => setShowBulkConfirm(true);

  const confirmBulkDelete = async () => {
    // Close modal and reset selection immediately
    const idsToDelete = [...selectedIds];
    setShowBulkConfirm(false);
    setIsSelectionMode(false);
    setSelectedIds(new Set());

    let successCount = 0;
    for (const id of idsToDelete) {
      const txn = transactions.find(t => t.id === id);
      if (txn) {
        try {
          await deleteTransaction(id, txn.parentTransactionId);
          successCount++;
        } catch (err) {
          console.error('Bulk delete error for:', id, err);
        }
      }
    }
    showToast(`Deleted ${successCount} of ${idsToDelete.length} transactions.`);
  };

  const loadMoreTransactions = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setLoadingMore(false);
      if (currentPage < totalPages) setCurrentPage(p => p + 1);
    }, 800);
  };

  const handlePageChange = (p) => {
    if (p >= 1 && p <= totalPages) setCurrentPage(p);
    window.scrollTo({ top: document.getElementById('txn-list-top')?.offsetTop - 100, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6 animate-fade-in pb-24 md:pb-0 max-w-5xl mx-auto">

      {/* Header with Glass Effect */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2 border-b border-white/5">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-white to-gray-400">Transaction History</h2>
          <p className="text-sm text-gray-400 mt-1">{totalItems} records found</p>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={() => setShowFilters(!showFilters)} variant="secondary" className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white backdrop-blur-md gap-2">
            <Filter size={18} />
            <span className="hidden md:inline">Filters</span>
          </Button>
          <Button onClick={toggleSelectionMode} variant="secondary" className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white backdrop-blur-md">
            {isSelectionMode ? <X size={18} /> : <CheckSquare size={18} />}
          </Button>

          <div className="relative flex-1 md:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setLocalSearchQuery('')}
              placeholder="Search transactions..."
              className="w-full pl-10 pr-12 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 focus:outline-none focus:border-indigo-500/50 hover:bg-white/10 transition-colors"
            />
            {localSearchQuery ? (
              <button
                onClick={() => setLocalSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white"
              >
                <X size={14} />
              </button>
            ) : (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400">⌘K</span>
            )}
          </div>

          <Button onClick={() => exportToCSV(filteredData, participantsLookup)} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20">
            <Download size={18} />
          </Button>
        </div>
      </div>

      {/* Collapsible Filter Bar */}
      {showFilters && (
        <div className="glass-card p-4 flex flex-col md:flex-row gap-4 items-end animate-slide-up">
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
            <Select label="Tag" value={filterTag} onChange={e => { setFilterTag(e.target.value); setCurrentPage(1); }} options={[{ value: '', label: 'All' }, ...tags.map(t => ({ value: t.name, label: t.name }))]} className="bg-gray-900/50 border-gray-700 text-sm" />
            <Input label="Date" type="date" value={filterDate} onChange={e => { setFilterDate(e.target.value); setFilterMonth(''); setCurrentPage(1); }} className="bg-gray-900/50 border-gray-700 text-sm" />
            <Input label="Month" type="month" value={filterMonth} onChange={e => { setFilterMonth(e.target.value); setFilterDate(''); setCurrentPage(1); }} className="bg-gray-900/50 border-gray-700 text-sm" />
            <Select
              label="Density"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              options={[{ value: 10, label: '10' }, { value: 20, label: '20' }, { value: 50, label: '50' }]}
              className="bg-gray-900/50 border-gray-700 text-sm"
            />
          </div>
          <Button
            variant="ghost"
            onClick={() => { setFilterTag(''); setFilterDate(''); setFilterMonth(''); }}
            className="text-xs text-gray-400 hover:text-white"
          >
            Clear
          </Button>
        </div>
      )}

      {/* List Container */}
      <div id="txn-list-top" className="space-y-8 min-h-[300px]">
        {storeLoading && (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-indigo-500" size={40} />
          </div>
        )}

        {currentTransactions.length === 0 && !storeLoading ? (
          <div className="glass-card p-12 text-center flex flex-col items-center justify-center text-gray-500">
            <Filter size={48} className="mb-4 opacity-20" />
            <p>No transactions found.</p>
          </div>
        ) : (
          Object.entries(groupedData).map(([date, txns], groupIdx) => (
            <div key={date} className="animate-slide-up" style={{ animationDelay: `${groupIdx * 100}ms` }}>
              <div className="sticky top-0 z-20 backdrop-blur-md py-2 mb-2 border-b border-white/5 flex justify-between items-center" style={{ backgroundColor: 'color-mix(in srgb, var(--bg-main) 80%, transparent)' }}>
                <h3 className="text-xs font-bold uppercase tracking-widest pl-2" style={{ color: 'var(--primary)' }}>{date}</h3>
                <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">{txns.length}</span>
              </div>

              <div className="space-y-2">
                {txns.map((txn, idx) => {
                  const linkedRefunds = transactions.filter(t =>
                    !t.isDeleted && (t.parentTransactionId === txn.id || (t.parentTransactionIds && t.parentTransactionIds.includes(txn.id)))
                  );
                  return (
                    <TransactionItem
                      key={txn.id}
                      txn={txn}
                      index={idx}
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

      {/* Pagination & Load More */}
      <div className="flex flex-col items-center gap-4 pt-4">
        {hasMoreHistory && (
          <Button variant="secondary" onClick={loadMoreTransactions} disabled={loadingMore} className="bg-white/5 hover:bg-white/10 text-gray-300 border-white/10 w-full max-w-xs">
            {loadingMore ? <Loader2 className="animate-spin mr-2" /> : <Download className="mr-2" size={16} />}
            Load Older Records
          </Button>
        )}

        {totalPages > 1 && (
          <div className="flex items-center gap-4 bg-white/5 rounded-full px-4 py-1 border border-white/5">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="p-1 hover:text-white text-gray-500 disabled:opacity-30"><ChevronLeft size={18} /></button>
            <span className="text-xs font-mono text-gray-300">{currentPage} / {totalPages}</span>
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="p-1 hover:text-white text-gray-500 disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>
        )}
      </div>

      {showSearch && <SearchPalette onClose={() => setShowSearch(false)} />}

      {/* Floating Selection Bar - positioned above FAB and mobile nav */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-36 md:bottom-8 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 glass-card px-4 md:px-6 py-3 flex items-center justify-between md:justify-start gap-4 md:gap-6 z-60 animate-slide-up border-white/20 shadow-2xl shadow-black/30">
          <span className="font-bold text-sm" style={{ color: 'var(--primary)' }}>{selectedIds.size} Selected</span>
          <div className="h-4 w-px bg-white/10 hidden md:block"></div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowBulkEdit(true)} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 font-bold text-sm transition-colors">
              <Edit2 size={16} /> Edit
            </button>
            <button onClick={handleBulkDelete} className="flex items-center gap-2 text-red-400 hover:text-red-300 font-bold text-sm transition-colors">
              <Trash2 size={16} /> Delete
            </button>
            <button onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false); }} className="text-gray-500 hover:text-white text-xs">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteData}
        title="Delete Transaction"
        message="Are you sure? This effectively removes it from the ledger."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteData(null)}
      />
      <ConfirmModal
        isOpen={showBulkConfirm}
        title={`Delete ${selectedIds.size} Transactions`}
        message="This will remove all selected transactions. This action cannot be undone."
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkConfirm(false)}
      />
      <BulkEditModal
        isOpen={showBulkEdit}
        selectedIds={selectedIds}
        onClose={() => setShowBulkEdit(false)}
        onSuccess={() => {
          setSelectedIds(new Set());
          setIsSelectionMode(false);
        }}
      />
    </div>
  );
};

export default History;