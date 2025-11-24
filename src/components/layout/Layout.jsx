import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Toast from '../common/Toast'; 
import useAppStore from '../../store/useAppStore';

const Layout = () => {
  // Retrieve toast state from store
  const toast = useAppStore(state => state.toast);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 relative">
      <Sidebar />
      
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <Outlet />
      </main>

      {/* Global Toast Notification */}
      {toast.show && <Toast message={toast.message} isError={toast.isError} />}
    </div>
  );
};

export default Layout;