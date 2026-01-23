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
  const isPrivacyEnabled = useAppStore(state => state.isPrivacyEnabled);
  // Default: Closed on Mobile, Open on Desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Hide FAB on console page
  const isConsolePage = location.pathname === '/console';

  return (
    <>
      {/* Main Layout Container */}
      <div className={`flex h-dvh text-gray-900 dark:text-gray-100 w-full overflow-hidden ${isPrivacyEnabled ? 'privacy-active' : ''}`} style={{ backgroundColor: 'var(--bg-main)', color: 'var(--text-main)' }}>

        {/* Sidebar Component - Fixed position, doesn't affect flex */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => {
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
        />

        {/* Main Content Wrapper - Full width on mobile, offset for sidebar on desktop */}
        <div className={`flex-1 flex flex-col min-w-0 w-full transition-all duration-300 overflow-y-auto overflow-x-hidden ${isSidebarOpen ? 'md:ml-64' : ''}`}>

          {/* Header / Toggle Area - Glass Menu Bar */}
          <header className="sticky top-0 z-30 flex items-center h-16 px-4 backdrop-blur-md bg-transparent border-b border-white/5 shrink-0">

            {/* Toggle Button - Enhanced with rounded hover effect */}
            <button
              onClick={toggleSidebar}
              className="hidden md:block p-2 mr-4 hover:bg-white/10 rounded-full transition-colors focus:outline-none"
              title={isSidebarOpen ? "Close Menu" : "Open Menu"}
            >
              {isSidebarOpen ? <X size={22} className="text-gray-300" /> : <Menu size={22} className="text-gray-300" />}
            </button>

            {/* Title - Enhanced typography */}
            <span className="ml-4 font-semibold text-lg tracking-tight text-white md:hidden">SplitTrack</span>
          </header>

          {/* Page Content - Full width mobile, responsive padding */}
          <main className="flex-1 w-full px-3 py-3 sm:px-4 sm:py-4 md:px-8 md:py-6 pb-24 md:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Fixed Overlays - OUTSIDE the flex container to not affect layout */}

      {/* Global Toast */}
      {toast.show && <Toast message={toast.message} isError={toast.isError} />}

      {/* Mobile Bottom Nav */}
      <MobileNav />

      {/* Mobile FAB - Hidden on Console page - Enhanced with animation */}
      {!isConsolePage && (
        <button
          onClick={() => navigate('/add')}
          className="md:hidden fixed bottom-24 right-5 h-14 w-14 bg-linear-to-br from-sky-500 to-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center z-50 focus:outline-none focus:ring-4 focus:ring-sky-300/50 fab-animated fab-ripple haptic-tap safe-area-bottom"
          aria-label="Add Transaction"
        >
          <Plus size={28} />
        </button>
      )}
    </>
  );
};

export default Layout;