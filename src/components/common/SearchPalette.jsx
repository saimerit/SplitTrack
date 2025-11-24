import { useState, useMemo } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';
import Fuse from 'fuse.js';
import useAppStore from '../../store/useAppStore';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '../../utils/formatters';

const SearchPalette = ({ onClose }) => {
  const { transactions } = useAppStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  
  // FIX: Removed 'results' state and 'useEffect'.
  // Derived state should be calculated during render.

  const fuse = useMemo(() => {
    return new Fuse(transactions, {
      keys: ['expenseName', 'amount', 'category', 'place', 'tag'],
      threshold: 0.4,
    });
  }, [transactions]);

  // FIX: Calculate results directly using useMemo.
  // This runs automatically whenever 'query' or 'fuse' changes.
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const searchResults = fuse.search(query);
    return searchResults.slice(0, 10).map(r => r.item);
  }, [query, fuse]);

  const handleSelect = (txn) => {
    navigate('/add', { state: { ...txn, isEditMode: true } });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center border-b border-gray-200 dark:border-gray-700 p-4">
          <Search className="text-gray-400 mr-3" />
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none text-lg text-gray-800 dark:text-gray-200 placeholder-gray-400"
            placeholder="Search transactions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X /></button>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {results.map(txn => (
            <div 
              key={txn.id} 
              onClick={() => handleSelect(txn)}
              className="p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-sky-50 dark:hover:bg-gray-700 cursor-pointer flex justify-between items-center"
            >
              <div>
                <p className="font-medium text-gray-800 dark:text-gray-200">{txn.expenseName}</p>
                <p className="text-xs text-gray-500">{formatDate(txn.timestamp)} • {txn.category}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-gray-700 dark:text-gray-300">{formatCurrency(txn.amount)}</span>
                <ChevronRight size={16} className="text-gray-400" />
              </div>
            </div>
          ))}
          {query && results.length === 0 && (
            <div className="p-8 text-center text-gray-500">No matches found.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPalette;