import { useState } from 'react';
import { X } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { normalize } from '../../utils/formatters';

const ParticipantSelector = ({ selectedIds, onAdd, onRemove }) => {
  const { participants } = useAppStore();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);

  // Filter logic: Must match search AND not already be selected
  const results = participants.filter(p => {
    if (selectedIds.includes(p.uniqueId)) return false;
    return normalize(p.name).includes(normalize(search)) || normalize(p.uniqueId).includes(normalize(search));
  });

  const handleSelect = (uid) => {
    onAdd(uid);
    setSearch('');
    setShowResults(false);
  };

  // Helpers to look up names for the chips
  const getParticipantName = (uid) => {
    const p = participants.find(part => part.uniqueId === uid);
    return p ? `${p.name} (${p.uniqueId})` : uid;
  };

  return (
    <div className="space-y-4">
      <div className="relative group">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Participants (excluding you)
        </label>
        <input
          type="text"
          placeholder="Search name or ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => {
            // Small delay to allow click to register if onMouseDown doesn't catch it
            setTimeout(() => setShowResults(false), 200);
          }}
          className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        />
        
        {/* Search Dropdown */}
        {showResults && search && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
            {results.length > 0 ? results.map(p => (
              <div 
                key={p.uniqueId}
                // FIX: Use onMouseDown to prevent input blur from hiding list before click registers
                onMouseDown={(e) => {
                  e.preventDefault(); 
                  handleSelect(p.uniqueId);
                }}
                className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-gray-800 dark:text-gray-200"
              >
                <div className="font-medium">{p.name}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{p.uniqueId}</div>
              </div>
            )) : (
              <div className="px-4 py-2 text-gray-500 dark:text-gray-400">No matches found</div>
            )}
          </div>
        )}
      </div>

      {/* Selected Chips */}
      <div className="flex flex-wrap gap-2">
        {selectedIds.map(uid => (
          <span key={uid} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 animate-fade-in">
            {getParticipantName(uid)}
            <button type="button" onClick={() => onRemove(uid)} className="hover:text-sky-900 dark:hover:text-sky-100">
              <X size={14} />
            </button>
          </span>
        ))}
        {selectedIds.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400">No participants added yet.</p>
        )}
      </div>
    </div>
  );
};

export default ParticipantSelector;