import { useState, useMemo } from 'react';
import { X, Users, ChevronDown, Search, Plus } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { normalize } from '../../utils/formatters';
import UserAvatar from '../common/UserAvatar';

/**
 * ParticipantSelector - Avatar-based visual participant picker
 * Shows grid of avatars for quick selection + search for larger lists
 */
const ParticipantSelector = ({ selectedIds, onAdd, onRemove, onGroupAdd }) => {
  const { participants, userSettings } = useAppStore();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [showAllParticipants, setShowAllParticipants] = useState(false);

  // Safely access saved groups from settings
  const savedGroups = userSettings?.participantGroups || [];

  // Quick-select participants (first 8 not selected)
  const quickSelectParticipants = useMemo(() => {
    return participants
      .filter(p => !selectedIds.includes(p.uniqueId))
      .slice(0, 8);
  }, [participants, selectedIds]);

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

  const handleGroupSelect = (members) => {
    if (onGroupAdd) onGroupAdd(members);
    setShowGroups(false);
  };

  // Helpers to look up names for the chips
  const getParticipantName = (uid) => {
    const p = participants.find(part => part.uniqueId === uid);
    return p ? p.name : uid;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
          Split With
        </label>

        {/* Group Selector Toggle */}
        {savedGroups.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowGroups(!showGroups)}
              className="flex items-center gap-1 text-xs font-bold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors haptic-tap"
            >
              <Users size={14} />
              <span>Add Group</span>
              <ChevronDown size={12} className={`transition-transform ${showGroups ? 'rotate-180' : ''}`} />
            </button>

            {/* Group Dropdown */}
            {showGroups && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowGroups(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-20 overflow-hidden py-1">
                  {savedGroups.map(group => (
                    <button
                      key={group.id || group.name}
                      type="button"
                      onClick={() => handleGroupSelect(group.members)}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="font-medium">{group.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{group.members.length} members</div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Avatar Quick-Select Grid */}
      {quickSelectParticipants.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {quickSelectParticipants.map(p => (
            <button
              key={p.uniqueId}
              type="button"
              onClick={() => handleSelect(p.uniqueId)}
              className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors group haptic-tap"
            >
              <UserAvatar name={p.name} uniqueId={p.uniqueId} size="lg" className="group-hover:ring-2 ring-sky-500 ring-offset-2 ring-offset-gray-900 transition-all" />
              <span className="text-[10px] text-gray-400 group-hover:text-gray-300 font-medium max-w-[60px] truncate">
                {p.name.split(' ')[0]}
              </span>
            </button>
          ))}

          {/* Show More Button */}
          {participants.filter(p => !selectedIds.includes(p.uniqueId)).length > 8 && (
            <button
              type="button"
              onClick={() => setShowAllParticipants(!showAllParticipants)}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl hover:bg-white/5 transition-colors haptic-tap w-14"
            >
              <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                <Plus size={18} className="text-gray-400" />
              </div>
              <span className="text-[10px] text-gray-400 font-medium">More</span>
            </button>
          )}
        </div>
      )}

      {/* Search Input */}
      <div className="relative group">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Search size={16} />
        </div>
        <input
          type="text"
          placeholder="Search name or ID..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          onBlur={() => setTimeout(() => setShowResults(false), 200)}
          className="block w-full pl-10 pr-4 py-3 border border-white/10 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 bg-white/5 dark:text-gray-200 transition-all"
        />

        {/* Search Dropdown */}
        {showResults && search && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-lg max-h-60 overflow-auto">
            {results.length > 0 ? results.slice(0, 10).map(p => (
              <div
                key={p.uniqueId}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(p.uniqueId); }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
              >
                <UserAvatar name={p.name} uniqueId={p.uniqueId} size="sm" />
                <div>
                  <div className="font-medium text-gray-200">{p.name}</div>
                  <div className="text-xs text-gray-500">{p.uniqueId}</div>
                </div>
              </div>
            )) : (
              <div className="px-4 py-3 text-gray-500">No matches found</div>
            )}
          </div>
        )}
      </div>

      {/* Selected Chips */}
      <div className="flex flex-wrap gap-2">
        {selectedIds.map(uid => (
          <span key={uid} className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full text-sm font-medium bg-sky-500/20 text-sky-300 border border-sky-500/30 cascade-item">
            <UserAvatar name={getParticipantName(uid)} uniqueId={uid} size="xs" />
            <span>{getParticipantName(uid)}</span>
            <button type="button" onClick={() => onRemove(uid)} className="hover:text-white transition-colors haptic-tap">
              <X size={14} />
            </button>
          </span>
        ))}
        {selectedIds.length === 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 italic">Tap avatars above to add participants</p>
        )}
      </div>
    </div>
  );
};

export default ParticipantSelector;
