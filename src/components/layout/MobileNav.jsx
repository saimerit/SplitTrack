import { LayoutDashboard, PlusCircle, History, Sparkles, Settings } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const MobileNav = () => {
    const navClass = ({ isActive }) =>
        `flex flex-col items-center justify-center w-full h-full text-xs font-medium transition-colors ${isActive ? 'text-sky-600 dark:text-sky-400' : 'text-gray-500 dark:text-gray-400'
        }`;

    return (
        <div className="fixed bottom-0 left-0 z-50 w-full h-16 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:hidden pb-safe animate-slide-up">
            <div className="grid h-full grid-cols-5 mx-auto max-w-lg">
                <NavLink to="/" className={navClass}>
                    <LayoutDashboard size={20} className="mb-1" />
                    <span>Home</span>
                </NavLink>
                <NavLink to="/history" className={navClass}>
                    <History size={20} className="mb-1" />
                    <span>History</span>
                </NavLink>
                <NavLink to="/add" className={navClass}>
                    <PlusCircle size={24} className="mb-1 text-sky-600 dark:text-sky-400" />
                    <span>Add</span>
                </NavLink>
                <NavLink to="/sandbox" className={navClass}>
                    <Sparkles size={20} className="mb-1" />
                    <span>Sandbox</span>
                </NavLink>
                <NavLink to="/Settings" className={navClass}>
                    <Settings size={20} className="mb-1" />
                    <span>Settings</span>
                </NavLink>
            </div>
        </div>
    );
};

export default MobileNav;
