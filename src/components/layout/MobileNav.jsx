import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    LayoutDashboard, History, Sparkles, Menu, X,
    Database, BarChart2, Calendar, Activity, Tag, Target, FileText, Settings, List,
    ChevronDown, PlusCircle, Terminal
} from 'lucide-react';
import useAppStore from '../../store/useAppStore';

const MobileNav = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { groups, activeGroupId, setActiveGroupId } = useAppStore();
    const [isGroupMenuOpen, setIsGroupMenuOpen] = useState(false);

    const activeGroup = groups.find(g => g.id === activeGroupId);
    const activeGroupName = activeGroup ? activeGroup.name : 'Personal';

    const switchGroup = (id) => {
        setActiveGroupId(id);
        setIsGroupMenuOpen(false);
    };

    const navClass = ({ isActive }) =>
        `flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-colors ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'
        }`;

    const menuLinkClass = ({ isActive }) =>
        `flex flex-col items-center justify-center p-3 rounded-xl transition-all ${isActive
            ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400 font-semibold'
            : 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`;

    // Close menu when a link is clicked
    const closeMenu = () => setIsMenuOpen(false);

    return (
        <>
            {/* --- MENU DRAWER (SLIDE UP ANIMATION) --- */}
            {/* Backdrop */}
            <div
                className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={closeMenu}
            />

            {/* Drawer Panel */}
            <div className={`
        fixed bottom-16 left-0 z-40 w-full 
        rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] border-t border-white/10
        transition-transform duration-300 cubic-bezier(0.32, 0.72, 0, 1) md:hidden
        ${isMenuOpen ? 'translate-y-0' : 'translate-y-[110%]'}
      `} style={{ backgroundColor: 'var(--bg-surface)' }}>
                {/* Drawer Handle */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={closeMenu}>
                    <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                </div>

                {/* Space Switcher (Mobile) */}
                <div className="px-6 py-2">
                    <div className="relative">
                        <button
                            onClick={() => setIsGroupMenuOpen(!isGroupMenuOpen)}
                            className="w-full flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 active:scale-[0.98] transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center text-sm font-bold shrink-0">
                                    {activeGroupName.charAt(0)}
                                </div>
                                <div className="text-left">
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Current Space</p>
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{activeGroupName}</p>
                                </div>
                            </div>
                            <ChevronDown size={18} className={`text-gray-400 transition-transform ${isGroupMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isGroupMenuOpen && (
                            <div className="absolute bottom-full left-0 w-full mb-2 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden animate-slide-up">
                                <div className="p-1 max-h-48 overflow-y-auto">
                                    <button onClick={() => switchGroup('personal')} className="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Personal
                                    </button>
                                    {groups.map(g => (
                                        <button key={g.id} onClick={() => switchGroup(g.id)} className="w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-3">
                                            <span className="w-2 h-2 rounded-full bg-indigo-400"></span> {g.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t border-gray-100 dark:border-gray-700 p-2 bg-gray-50 dark:bg-gray-700/30">
                                    <NavLink to="/data" onClick={() => { setIsGroupMenuOpen(false); closeMenu(); }} className="w-full py-2 text-xs text-sky-600 font-medium hover:bg-sky-50 rounded-lg flex items-center justify-center gap-2 transition-colors">
                                        <PlusCircle size={14} /> Manage Spaces
                                    </NavLink>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Menu Grid */}
                <div className="p-4 grid grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto pb-8">
                    <NavLink to="/data" onClick={closeMenu} className={menuLinkClass}>
                        <Database size={24} className="mb-2" /> Data
                    </NavLink>
                    <NavLink to="/analytics" onClick={closeMenu} className={menuLinkClass}>
                        <BarChart2 size={24} className="mb-2" /> Analytics
                    </NavLink>
                    <NavLink to="/timeline" onClick={closeMenu} className={menuLinkClass}>
                        <List size={24} className="mb-2" /> Timeline
                    </NavLink>
                    <NavLink to="/calendar" onClick={closeMenu} className={menuLinkClass}>
                        <Calendar size={24} className="mb-2" /> Calendar
                    </NavLink>
                    <NavLink to="/insights" onClick={closeMenu} className={menuLinkClass}>
                        <Activity size={24} className="mb-2" /> Insights
                    </NavLink>
                    <NavLink to="/tags" onClick={closeMenu} className={menuLinkClass}>
                        <Tag size={24} className="mb-2" /> Tags
                    </NavLink>
                    <NavLink to="/goals" onClick={closeMenu} className={menuLinkClass}>
                        <Target size={24} className="mb-2" /> Goals
                    </NavLink>
                    <NavLink to="/templates" onClick={closeMenu} className={menuLinkClass}>
                        <FileText size={24} className="mb-2" /> Templates
                    </NavLink>
                    <NavLink to="/console" onClick={closeMenu} className={menuLinkClass}>
                        <Terminal size={24} className="mb-2" /> Console
                    </NavLink>
                    <NavLink to="/settings" onClick={closeMenu} className={menuLinkClass}>
                        <Settings size={24} className="mb-2" /> Settings
                    </NavLink>
                </div>
            </div>

            {/* --- BOTTOM NAVIGATION BAR --- */}
            <div className="mobile-nav fixed bottom-0 left-0 z-50 w-full h-16 border-t border-white/10 md:hidden" style={{ backgroundColor: 'var(--bg-surface)' }}>
                <div className="grid h-full grid-cols-4 mx-auto max-w-lg">

                    <NavLink to="/" className={navClass} onClick={closeMenu}>
                        <LayoutDashboard size={22} className="mb-1" /> Home
                    </NavLink>

                    <NavLink to="/history" className={navClass} onClick={closeMenu}>
                        <History size={22} className="mb-1" /> History
                    </NavLink>

                    <NavLink to="/sandbox" className={navClass} onClick={closeMenu}>
                        <Sparkles size={22} className="mb-1" /> Sandbox
                    </NavLink>

                    {/* Menu Toggle Button */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-medium transition-all ${isMenuOpen ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'
                            }`}
                    >
                        {isMenuOpen ? (
                            <X size={22} className="mb-1 transition-transform rotate-90" />
                        ) : (
                            <Menu size={22} className="mb-1" />
                        )}
                        Menu
                    </button>

                </div>
            </div>
        </>
    );
};

export default MobileNav;
