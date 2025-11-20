import { useState } from 'react';
// Removed unused imports: useEffect, formatCurrency

const SplitAllocator = ({ 
  method, 
  participants, 
  totalAmount, 
  splits, 
  onSplitChange 
}) => {
  const [lockedInputs, setLockedInputs] = useState(new Set());

  const handleDynamicChange = (uid, newValueStr) => {
    const newVal = parseFloat(newValueStr) || 0;
    const newValPaise = Math.round(newVal * 100);
    
    const newLocked = new Set(lockedInputs);
    if (newValueStr !== '') newLocked.add(uid);
    else newLocked.delete(uid);
    setLockedInputs(newLocked);

    const newSplits = { ...splits, [uid]: newValPaise };
    
    // Logic uses float math for inputs (Rupees)
    const totalRupees = totalAmount / 100; 
    
    let lockedSum = 0;
    const unlockedIds = [];
    
    participants.forEach(p => {
      if (p.uniqueId === uid) {
        lockedSum += newVal;
      } 
      else if (newLocked.has(p.uniqueId)) {
        lockedSum += (splits[p.uniqueId] || 0) / 100;
      } 
      else {
        unlockedIds.push(p.uniqueId);
      }
    });

    const remaining = totalRupees - lockedSum;

    if (unlockedIds.length > 0) {
      const share = remaining / unlockedIds.length;
      const sharePaise = Math.round(share * 100);
      
      unlockedIds.forEach(unlockedId => {
        newSplits[unlockedId] = sharePaise;
      });
    }

    onSplitChange(newSplits);
  };

  const handlePercentChange = (uid, newVal) => {
    onSplitChange({ ...splits, [uid]: parseFloat(newVal) || 0 });
  };

  if (method === 'equal') {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Splitting equally among {participants.length} person(s).
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {participants.map(p => {
        const isDynamic = method === 'dynamic';
        const val = splits[p.uniqueId];
        
        const displayVal = isDynamic 
          ? (val !== undefined ? (val / 100).toFixed(2) : '') 
          : (val || '');

        return (
          <div key={p.uniqueId} className="flex items-center gap-3">
            <label className="w-1/2 text-sm text-gray-600 dark:text-gray-400 truncate">
              {p.name}
            </label>
            
            {isDynamic && <span className="text-gray-500">₹</span>}
            
            <input
              type="number"
              step="0.01"
              value={displayVal}
              onChange={(e) => isDynamic 
                ? handleDynamicChange(p.uniqueId, e.target.value)
                : handlePercentChange(p.uniqueId, e.target.value)
              }
              className="block w-1/2 px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
            />
            
            {!isDynamic && <span className="text-gray-500">%</span>}
          </div>
        );
      })}
    </div>
  );
};

export default SplitAllocator;