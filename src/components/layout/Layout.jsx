import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Plus, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import Toast from '../common/Toast';
import useAppStore from '../../store/useAppStore';
import SplitTrackLogo from '../branding/SplitTrackLogo';
import GridGlow from '../reactbits/GridGlow';

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
      <div className={`relative flex h-dvh w-full overflow-hidden bg-background text-foreground ${isPrivacyEnabled ? 'privacy-active' : ''}`}>
        <GridGlow />

        {/* Sidebar Component - Fixed position, doesn't affect flex */}
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => {
            if (window.innerWidth < 768) setIsSidebarOpen(false);
          }}
        />

        {/* Main Content Wrapper - Full width on mobile, offset for sidebar on desktop */}
        <div className={`relative z-10 flex min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden transition-all duration-300 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-20'}`}>

          {/* Header / Toggle Area - Glass Menu Bar */}
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl md:px-8">

            {/* Toggle Button - Enhanced with rounded hover effect */}
            <button
              onClick={toggleSidebar}
              className="hidden rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:block"
              title={isSidebarOpen ? "Close Menu" : "Open Menu"}
            >
              <Menu size={20} />
            </button>

            {/* Title - Enhanced typography */}
            <SplitTrackLogo className="md:hidden" />
            <button onClick={() => navigate('/history')} className="hidden items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm hover:bg-accent lg:flex">
              <Search size={16} /> Search transactions
            </button>
          </header>

          {/* Page Content - Full width mobile, responsive padding */}
          <main className="flex-1 w-full px-4 py-5 pb-24 sm:px-6 md:px-8 md:py-8 md:pb-8">
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
          className="fixed bottom-24 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          aria-label="Add Transaction"
        >
          <Plus size={28} />
        </button>
      )}
    </>
  );
};

export default Layout;
