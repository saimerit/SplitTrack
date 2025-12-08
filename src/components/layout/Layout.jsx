import { useState } from 'react'; // Import useState
import { Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react'; // Import icons
import Sidebar from './Sidebar';
import Toast from '../common/Toast'; 
import useAppStore from '../../store/useAppStore';

const Layout = () => {
  const toast = useAppStore(state => state.toast);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // New State

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-white dark:bg-gray-800 p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-sky-600 dark:text-sky-500">SplitTrack</h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Pass the open state to Sidebar */}
      <Sidebar 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Outlet />
      </main>

      {toast.show && <Toast message={toast.message} isError={toast.isError} />}
    </div>
  );
};

export default Layout;