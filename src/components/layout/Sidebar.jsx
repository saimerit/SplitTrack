import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, PlusCircle, History, Database, 
  BarChart2, Calendar, Activity, Tag, Target, FileText, 
  Settings, LogOut, Moon, Sun, List 
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { useAuth } from '../../hooks/useAuth';
import OfflineBanner from './OfflineBanner';

const Sidebar = () => {
  const { theme, toggleTheme } = useTheme();
  const { logout } = useAuth();

  const navClass = ({ isActive }) => 
    `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive 
      ? 'bg-sky-100 text-sky-600 font-semibold dark:bg-sky-900 dark:text-sky-300' 
      : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
    }`;

  return (
    <nav className="hidden md:flex md:flex-col md:w-64 h-full bg-white border-r border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      
      <OfflineBanner />

      <div className="px-4 pt-5 pb-2">
        <h1 className="text-2xl font-bold text-sky-600 dark:text-sky-500">SplitTrack</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Web CLI Edition</p>
      </div>

      <div className="flex-1 px-2 pb-2 space-y-1 overflow-y-auto no-scrollbar">
        <NavLink to="/" className={navClass}><LayoutDashboard size={20}/> Balances</NavLink>
        <NavLink to="/add" className={navClass}><PlusCircle size={20}/> Add Transaction</NavLink>
        <NavLink to="/history" className={navClass}><History size={20}/> History</NavLink>
        <NavLink to="/data" className={navClass}><Database size={20}/> Manage Data</NavLink>
        <NavLink to="/analytics" className={navClass}><BarChart2 size={20}/> Analytics</NavLink>
        <NavLink to="/timeline" className={navClass}><List size={20}/> Timeline</NavLink> {/* Added Link */}
        <NavLink to="/calendar" className={navClass}><Calendar size={20}/> Calendar</NavLink>
        <NavLink to="/insights" className={navClass}><Activity size={20}/> Insights</NavLink>
        <NavLink to="/tags" className={navClass}><Tag size={20}/> Tags</NavLink>
        <NavLink to="/goals" className={navClass}><Target size={20}/> Goals</NavLink>
        <NavLink to="/templates" className={navClass}><FileText size={20}/> Templates</NavLink>
        <NavLink to="/settings" className={navClass}><Settings size={20}/> Settings</NavLink>
        
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/50">
          <LogOut size={20}/> Sign Out
        </button>

        <button onClick={toggleTheme} className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
          <div className="flex items-center gap-3">
            {theme === 'dark' ? <Moon size={20}/> : <Sun size={20}/>}
            <span>Theme</span>
          </div>
        </button>
      </div>
    </nav>
  );
};

export default Sidebar;