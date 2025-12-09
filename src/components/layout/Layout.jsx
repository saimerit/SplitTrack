import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import Toast from '../common/Toast'; 
import useAppStore from '../../store/useAppStore';

const Layout = () => {
  const toast = useAppStore(state => state.toast);
  // Default: Closed on Mobile, Open on Desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth >= 768);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    // CHANGED: h-screen -> min-h-screen, removed overflow-hidden to allow body scroll
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      
      {/* Sidebar Component */}
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => {
          if (window.innerWidth < 768) setIsSidebarOpen(false);
        }} 
      />

      {/* Main Content Wrapper */}
      {/* CHANGED: Removed h-full and overflow-hidden/relative to let content grow */}
      <div className="flex-1 flex flex-col transition-all duration-300">
        
        {/* Header / Toggle Area */}
        {/* CHANGED: Added sticky top-0 z-30 so header stays visible while scrolling */}
        <header className="sticky top-0 z-30 flex items-center p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
          
          {/* Toggle Button - Visible on BOTH Mobile and Desktop */}
          <button 
            onClick={toggleSidebar}
            className="p-2 mr-4 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg focus:outline-none"
            title={isSidebarOpen ? "Close Menu" : "Open Menu"}
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Title - Visible on Mobile (or always if you prefer) */}
          <h1 className="text-xl font-bold text-sky-600 dark:text-sky-500 md:hidden">SplitTrack</h1>
        </header>

        {/* Page Content */}
        {/* CHANGED: Removed overflow-auto (since body scrolls now) */}
        <main className="flex-1 p-3 sm:p-4 md:p-8">
           <Outlet />
        </main>
      </div>

      {/* Global Toast */}
      {toast.show && <Toast message={toast.message} isError={toast.isError} />}
    </div>
  );
};

export default Layout;