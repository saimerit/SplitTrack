import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import Toast from '../common/Toast';
import useAppStore from '../../store/useAppStore';

const Layout = () => {
  const toast = useAppStore(state => state.toast);
  // Default: Closed on Mobile, Open on Desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Hide FAB on console page
  const isConsolePage = location.pathname === '/console';

  return (
    // min-h-screen to allow full height, w-full to fill width. removed overflow-x-hidden to avoid clipping.
    <div className="flex min-h-screen text-gray-900 dark:text-gray-100 w-full" style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>

      {/* Sidebar Component */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => {
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }}
      />

      {/* Main Content Wrapper - Added min-w-0 to prevent flex children from forcing overflow */}
      <div className="flex-1 flex flex-col min-w-0 transition-all duration-300">

        {/* Header / Toggle Area */}
        <header className="sticky top-0 z-30 flex items-center p-4 border-b border-white/10 shrink-0" style={{ backgroundColor: 'var(--bg-surface)' }}>

          {/* Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="hidden md:block p-2 mr-4 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:outline-none"
            title={isSidebarOpen ? "Close Menu" : "Open Menu"}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Title */}
          <h1 className="text-xl font-bold text-sky-600 dark:text-sky-500 md:hidden">SplitTrack</h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 sm:p-4 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Global Toast */}
      {toast.show && <Toast message={toast.message} isError={toast.isError} />}

      {/* Mobile Bottom Nav */}
      <MobileNav />

      {/* Mobile FAB - Hidden on Console page */}
      {!isConsolePage && (
        <button
          onClick={() => navigate('/add')}
          className="md:hidden fixed bottom-24 right-5 h-14 w-14 bg-sky-600 hover:bg-sky-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform active:scale-95 z-50 focus:outline-none focus:ring-4 focus:ring-sky-300"
          aria-label="Add Transaction"
        >
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};

export default Layout;