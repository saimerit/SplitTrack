import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, History, Database,
  BarChart2, Calendar, Activity, Tag, Target, FileText,
  Settings, List, ChevronDown, Layers, Sparkles
} from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import OfflineBanner from './OfflineBanner';

const Sidebar = ({ isOpen, onClose }) => {
  const { groups, activeGroupId, setActiveGroupId } = useAppStore();
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeGroupName = activeGroup ? activeGroup.name : 'Personal';

  const navClass = ({ isActive }) =>
    `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
      ? 'bg-sky-100 text-sky-600 font-semibold dark:bg-sky-900 dark:text-sky-300'
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
    }`;

  const switchGroup = (id) => {
    setActiveGroupId(id);
    setIsGroupMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar Navigation */}
      {/* Logic Updated: 
         - Mobile: fixed (unchanged)
         - Desktop: Changed from 'relative' to 'sticky top-0 h-screen' 
           This ensures sidebar stays visible while body scrolls.
      */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 h-full border-r border-white/10 
        transition-all duration-300 ease-in-out transform flex flex-col
        ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full w-64 md:translate-x-0 md:w-0 md:opacity-0 md:overflow-hidden'}
        md:sticky md:top-0 md:h-screen md:overflow-y-auto
      `} style={{ backgroundColor: 'var(--bg-surface)' }}>

        {/* Header Section */}
        <div className="px-4 pt-16 pb-4 border-b border-gray-100 dark:border-gray-700 shrink-0 md:pt-5">
          <h1 className="text-xl font-bold text-sky-600 dark:text-sky-500 mb-4 whitespace-nowrap">SplitTrack</h1>

          <OfflineBanner />

          {/* Group Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 hover:border-sky-300 transition-colors"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded bg-sky-100 text-sky-600 flex items-center justify-center text-xs font-bold shrink-0">
                  {activeGroupName.charAt(0)}
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{activeGroupName} Space</span>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform ${isGroupMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isGroupMenuOpen && (
              <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-50 overflow-hidden animate-fade-in">
                <div className="p-1 max-h-48 overflow-y-auto">
                  <button onClick={() => switchGroup('personal')} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-sky-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Personal
                  </button>
                  {groups.map(g => (
                    <button key={g.id} onClick={() => switchGroup(g.id)} className="w-full text-left px-3 py-2 text-sm rounded hover:bg-sky-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400"></span> {g.name}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-700/30">
                  <NavLink to="/data" onClick={() => { setIsGroupMenuOpen(false); onClose(); }} className="text-xs text-sky-600 hover:underline flex items-center justify-center gap-1">
                    <PlusCircle size={12} /> Manage Spaces
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Links */}
        <div className="flex-1 px-2 pb-2 mt-2 space-y-1 overflow-y-auto no-scrollbar whitespace-nowrap">
          <NavLink to="/" onClick={onClose} className={navClass}><LayoutDashboard size={20} /> Balances</NavLink>
          <NavLink to="/add" onClick={onClose} className={navClass}><PlusCircle size={20} /> Add Transaction</NavLink>
          <NavLink to="/history" onClick={onClose} className={navClass}><History size={20} /> History</NavLink>
          <NavLink to="/data" onClick={onClose} className={navClass}><Database size={20} /> Manage Data</NavLink>
          <NavLink to="/analytics" onClick={onClose} className={navClass}><BarChart2 size={20} /> Analytics</NavLink>
          <NavLink to="/timeline" onClick={onClose} className={navClass}><List size={20} /> Timeline</NavLink>
          <NavLink to="/calendar" onClick={onClose} className={navClass}><Calendar size={20} /> Calendar</NavLink>
          <NavLink to="/insights" onClick={onClose} className={navClass}><Activity size={20} /> Insights</NavLink>
          <NavLink to="/tags" onClick={onClose} className={navClass}><Tag size={20} /> Tags</NavLink>
          <NavLink to="/goals" onClick={onClose} className={navClass}><Target size={20} /> Goals</NavLink>
          <NavLink to="/templates" onClick={onClose} className={navClass}><FileText size={20} /> Templates</NavLink>
          <NavLink to="/sandbox" onClick={onClose} className={navClass}><Sparkles size={20} /> Sandbox</NavLink>
          <NavLink to="/settings" onClick={onClose} className={navClass}><Settings size={20} /> Settings</NavLink>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;