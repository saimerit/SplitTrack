import { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Auth & Hooks
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { useFirestoreSync } from './hooks/useFirestoreSync';
import { useTheme } from './hooks/useTheme'; // Import Theme Hook

// Components
import Loader from './components/common/Loader';
import Layout from './components/layout/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import AddTransaction from './pages/AddTransaction';
import History from './pages/History';
import ManageData from './pages/ManageData';
import Analytics from './pages/Analytics';
import CalendarPage from './pages/Calendar';
import Insights from './pages/Insights';
import TagsAnalysis from './pages/TagsAnalysis';
import Goals from './pages/Goals';
import Templates from './pages/Templates';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Timeline from './pages/Timeline';
import Sandbox from './pages/Sandbox';

// --- NEW: Theme Initializer Component ---
const ThemeInit = () => {
  useTheme(); // This activates the theme logic globally
  return null;
};

const AppDataSyncer = ({ children }) => {
  useFirestoreSync();
  return children;
};

const ProtectedRoute = ({ children }) => {
  const { user, authLoading, isAllowed } = useAuth();

  if (authLoading) return <Loader />;

  if (!user || !isAllowed) {
    return <Navigate to="/login" replace />;
  }

  return <AppDataSyncer>{children}</AppDataSyncer>;
};

const App = () => {
  return (
    <BrowserRouter>
      {/* Initialize Theme immediately inside Router context if needed, or outside */}
      <ThemeInit />
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/add" element={<AddTransaction />} />
            <Route path="/history" element={<History />} />
            <Route path="/data" element={<ManageData />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/tags" element={<TagsAnalysis />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/sandbox" element={<Sandbox />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;