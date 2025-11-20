import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { loginWithGoogle } from '../services/authService';

const Login = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) return null; 
  if (user) return <Navigate to="/" replace />;

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch {
      // Fixed: Removed unused error variable
      alert("Login failed. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-sm p-8 bg-white rounded-lg shadow-xl dark:bg-gray-800 border dark:border-gray-700">
        <h2 className="text-3xl font-bold text-sky-600 dark:text-sky-500 text-center">SplitTrack</h2>
        <p className="text-center text-gray-500 dark:text-gray-400 mt-2 mb-8">
          Please sign in to continue.
        </p>
        
        <button 
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg shadow-sm bg-white hover:bg-gray-50 dark:bg-gray-700 dark:hover:bg-gray-600 dark:border-gray-600 transition-colors"
        >
            <svg className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.65 5.501-6.086 9.49-11.303 9.49-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 11.827 4 2 13.827 2 26s9.827 22 22 22 22-9.827 22-22c0-1.341-.138-2.65-.389-3.917z"></path>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"></path>
                <path fill="#4CAF50" d="M24 48c5.643 0 10.7-1.855 14.389-4.961l-6.289-4.89C30.222 41.655 27.218 44 24 44c-5.14 0-9.48-3.53-11.024-8.293l-6.556 4.863C9.513 44.622 16.273 48 24 48z"></path>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.23-2.22 4.149-4.062 5.526l6.289 4.89c3.87-3.606 6.474-8.788 6.474-14.5A22.001 22.001 0 0 0 43.611 20.083z"></path>
            </svg>
            <span className="text-base font-medium text-gray-700 dark:text-gray-200">Sign in with Google</span>
        </button>
      </div>
    </div>
  );
};

export default Login;