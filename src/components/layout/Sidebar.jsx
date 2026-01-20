import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, History, Database,
  BarChart2, Calendar, Activity, Tag, Target, FileText,
  Settings, List, ChevronDown, ChevronRight, Sparkles, Terminal
} from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import OfflineBanner from './OfflineBanner';
import SidebarMetrics from './SidebarMetrics';

/**
 * CollapsibleSection - Renders a collapsible nav group with chevron animation
 * Now controlled by parent for accordion behavior
 */
const CollapsibleSection = ({ title, icon: Icon, children, isOpen, onToggle }) => {
  return (
    <div className="mb-3">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-xs uppercase tracking-wider font-bold text-gray-400 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} />}
          <span>{title}</span>
        </div>
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
        />
      </button>
      <div className={`space-y-0.5 overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
        {children}
      </div>
    </div>
  );
};

const Sidebar = ({ isOpen, onClose }) => {
  const { groups, activeGroupId, setActiveGroupId } = useAppStore();
  const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);

  // Accordion state - only one section open at a time
  const [openSection, setOpenSection] = useState('daily');

  const activeGroup = groups.find(g => g.id === activeGroupId);
  const activeGroupName = activeGroup ? activeGroup.name : 'Personal';

  const navClass = ({ isActive }) =>
    `w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 haptic-tap text-sm ${isActive
      ? 'bg-linear-to-r from-sky-500/20 to-indigo-500/10 text-sky-400 font-semibold border-l-2 border-sky-500'
      : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
    }`;

  const switchGroup = (id) => {
    setActiveGroupId(id);
    setIsGroupMenuOpen(false);
  };

  const handleSectionToggle = (section) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <>
      {/* Mobile Overlay - Enhanced with backdrop blur that intensifies as sidebar opens */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden transition-all duration-300"
          onClick={onClose}
        ></div>
      )}

      {/* Sidebar Navigation */}
      {/* Logic: 
         - Fixed positioning on both mobile AND desktop for locked sidebar
         - Sidebar scrolls internally if content overflows (two-finger scroll preserved)
         - Mobile: Uses 100dvh for consistent height
      */}
      <nav className={`
        fixed inset-y-0 left-0 z-50 w-72 
        bg-slate-900/95 backdrop-blur-xl 
        border-r border-white/10 
        transform transition-transform duration-300 ease-out flex flex-col
        h-dvh overflow-y-auto overflow-x-hidden
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:w-64
        ${!isOpen ? 'md:w-0 md:opacity-0 md:overflow-hidden md:-translate-x-full' : ''}
      `} style={{ backgroundColor: 'var(--bg-surface)' }}>

        {/* Header Section */}
        <div className="px-4 pt-16 pb-4 border-b border-white/10 shrink-0 md:pt-5">
          <h1 className="text-xl font-bold bg-linear-to-r from-sky-400 to-indigo-400 bg-clip-text text-transparent mb-4 whitespace-nowrap">SplitTrack</h1>

          <OfflineBanner />

          {/* Premium Workspace Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
              className="w-full flex items-center justify-between p-3 rounded-xl bg-linear-to-r from-white/5 to-white/2 border border-white/10 hover:border-white/20 transition-all duration-200 group haptic-tap"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-lg bg-linear-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-lg shadow-sky-500/20">
                  {activeGroupName.charAt(0)}
                </div>
                <div className="text-left">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">Workspace</p>
                  <span className="text-sm font-medium text-gray-200 truncate">{activeGroupName}</span>
                </div>
              </div>
              <ChevronDown size={16} className={`text-gray-400 transition-transform duration-200 group-hover:text-gray-300 ${isGroupMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isGroupMenuOpen && (
              <div className="absolute top-full left-0 w-full mt-2 bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 z-50 overflow-hidden animate-fade-in">
                <div className="p-2 max-h-48 overflow-y-auto">
                  <button onClick={() => switchGroup('personal')} className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-white/10 text-gray-300 flex items-center gap-3 transition-colors haptic-tap">
                    <span className="w-2.5 h-2.5 rounded-full bg-linear-to-r from-emerald-400 to-teal-400"></span> Personal
                  </button>
                  {groups.map(g => (
                    <button key={g.id} onClick={() => switchGroup(g.id)} className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-white/10 text-gray-300 flex items-center gap-3 transition-colors haptic-tap">
                      <span className="w-2.5 h-2.5 rounded-full bg-linear-to-r from-indigo-400 to-purple-400"></span> {g.name}
                    </button>
                  ))}
                </div>
                <div className="border-t border-white/10 p-2 bg-white/5">
                  <NavLink to="/data" onClick={() => { setIsGroupMenuOpen(false); onClose(); }} className="w-full py-2 text-xs text-sky-400 font-medium hover:text-sky-300 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                    <PlusCircle size={12} /> Manage Workspaces
                  </NavLink>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Navigation Sections - Accordion (one open at a time) */}
        <div className="flex-1 px-2 py-3 overflow-y-auto no-scrollbar">

          {/* Daily Operations */}
          <CollapsibleSection
            title="Daily Ops"
            isOpen={openSection === 'daily'}
            onToggle={() => handleSectionToggle('daily')}
          >
            <NavLink to="/" onClick={onClose} className={navClass}><LayoutDashboard size={18} /> Balances</NavLink>
            <NavLink to="/add" onClick={onClose} className={navClass}><PlusCircle size={18} /> Add Transaction</NavLink>
            <NavLink to="/history" onClick={onClose} className={navClass}><History size={18} /> History</NavLink>
          </CollapsibleSection>

          {/* Strategy & Analysis */}
          <CollapsibleSection
            title="Strategy"
            isOpen={openSection === 'strategy'}
            onToggle={() => handleSectionToggle('strategy')}
          >
            <NavLink to="/analytics" onClick={onClose} className={navClass}><BarChart2 size={18} /> Analytics</NavLink>
            <NavLink to="/timeline" onClick={onClose} className={navClass}><List size={18} /> Timeline</NavLink>
            <NavLink to="/calendar" onClick={onClose} className={navClass}><Calendar size={18} /> Calendar</NavLink>
            <NavLink to="/insights" onClick={onClose} className={navClass}><Activity size={18} /> Insights</NavLink>
            <NavLink to="/tags" onClick={onClose} className={navClass}><Tag size={18} /> Tags</NavLink>
            <NavLink to="/goals" onClick={onClose} className={navClass}><Target size={18} /> Goals</NavLink>
          </CollapsibleSection>

          {/* Admin & Tools */}
          <CollapsibleSection
            title="Admin"
            isOpen={openSection === 'admin'}
            onToggle={() => handleSectionToggle('admin')}
          >
            <NavLink to="/data" onClick={onClose} className={navClass}><Database size={18} /> Manage Data</NavLink>
            <NavLink to="/templates" onClick={onClose} className={navClass}><FileText size={18} /> Templates</NavLink>
            <NavLink to="/sandbox" onClick={onClose} className={navClass}><Sparkles size={18} /> Sandbox</NavLink>
            <NavLink to="/console" onClick={onClose} className={navClass}><Terminal size={18} /> Console</NavLink>
            <NavLink to="/settings" onClick={onClose} className={navClass}><Settings size={18} /> Settings</NavLink>
          </CollapsibleSection>
        </div>

        {/* Live Metrics Section */}
        <SidebarMetrics />
      </nav>
    </>
  );
};

export default Sidebar;
