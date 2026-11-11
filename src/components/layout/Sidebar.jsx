import { NavLink } from 'react-router-dom';
import { BarChart3, CalendarDays, Database, FileText, Goal, History, LayoutDashboard, List, PlusCircle, Settings, Sparkles, Tags, Terminal, X } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import OfflineBanner from './OfflineBanner';
import SplitTrackLogo from '../branding/SplitTrackLogo';

const primary = [{ to: '/', text: 'Overview', icon: <LayoutDashboard size={17} strokeWidth={1.8} /> }, { to: '/add', text: 'Add transaction', icon: <PlusCircle size={17} strokeWidth={1.8} /> }, { to: '/history', text: 'Activity', icon: <History size={17} strokeWidth={1.8} /> }];
const planning = [{ to: '/analytics', text: 'Analytics', icon: <BarChart3 size={17} strokeWidth={1.8} /> }, { to: '/timeline', text: 'Timeline', icon: <List size={17} strokeWidth={1.8} /> }, { to: '/calendar', text: 'Calendar', icon: <CalendarDays size={17} strokeWidth={1.8} /> }, { to: '/goals', text: 'Goals', icon: <Goal size={17} strokeWidth={1.8} /> }, { to: '/tags', text: 'Tags', icon: <Tags size={17} strokeWidth={1.8} /> }];
const manage = [{ to: '/data', text: 'Data', icon: <Database size={17} strokeWidth={1.8} /> }, { to: '/templates', text: 'Templates', icon: <FileText size={17} strokeWidth={1.8} /> }, { to: '/settings', text: 'Settings', icon: <Settings size={17} strokeWidth={1.8} /> }, { to: '/sandbox', text: 'Sandbox', icon: <Sparkles size={17} strokeWidth={1.8} /> }, { to: '/console', text: 'Console', icon: <Terminal size={17} strokeWidth={1.8} /> }];

const NavSection = ({ label, links, onNavigate, collapsed }) => (
  <div className="mb-6">
    {!collapsed && <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</p>}
    <div className="space-y-1">
      {links.map(({ to, text, icon }) => (
        <NavLink key={to} to={to} onClick={onNavigate} title={collapsed ? text : undefined} className={({ isActive }) => `flex items-center rounded-md py-2 text-sm transition-colors ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} ${isActive ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
          {icon}
          {!collapsed && text}
        </NavLink>
      ))}
    </div>
  </div>
);

const Sidebar = ({ isOpen, onClose }) => {
  const { groups, activeGroupId, setActiveGroupId } = useAppStore();
  const activeGroup = groups.find(group => group.id === activeGroupId);
  const name = activeGroup?.name || 'Personal';
  const collapsed = !isOpen;
  const navigate = () => { if (window.innerWidth < 768) onClose(); };

  return <>
    {isOpen && <button aria-label="Close navigation" className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm md:hidden" onClick={onClose} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-card/95 p-4 shadow-xl backdrop-blur-xl transition-all duration-300 md:translate-x-0 md:shadow-none ${isOpen ? 'w-72 translate-x-0' : '-translate-x-full md:w-20 md:translate-x-0 md:px-3'} `}>
      <div className={`mb-7 flex items-center pt-1 ${collapsed ? 'justify-center' : 'justify-between px-2'}`}><SplitTrackLogo compact={collapsed} /><button className="rounded-md p-2 text-muted-foreground hover:bg-accent md:hidden" onClick={onClose}><X size={18} /></button></div>
      {!collapsed && <OfflineBanner />}
      {!collapsed && <div className="mb-6 mt-3 rounded-lg border border-border bg-muted/40 p-2">
        <label className="sr-only" htmlFor="workspace">Workspace</label>
        <select id="workspace" value={activeGroupId} onChange={event => setActiveGroupId(event.target.value)} className="w-full bg-transparent px-2 py-1.5 text-sm font-medium outline-none">
          <option value="personal">Personal</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
        </select>
        <p className="px-2 pb-1 pt-1 text-xs text-muted-foreground">{name} workspace</p>
      </div>}
      <nav className="flex-1 overflow-y-auto pr-1"><NavSection label="Workspace" links={primary} onNavigate={navigate} collapsed={collapsed} /><NavSection label="Plan & review" links={planning} onNavigate={navigate} collapsed={collapsed} /><NavSection label="Manage" links={manage} onNavigate={navigate} collapsed={collapsed} /></nav>
      {!collapsed && <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-5 text-muted-foreground"><span className="font-medium text-foreground">Your ledger is synced</span><br />Changes are saved securely to your workspace.</div>}
    </aside>
  </>;
};

export default Sidebar;
