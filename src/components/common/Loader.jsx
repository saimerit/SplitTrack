// src/components/common/Loader.jsx
import { useState, useEffect } from 'react';

const Loader = () => {
  const [showLongLoadMsg, setShowLongLoadMsg] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLongLoadMsg(true);
    }, 5000); // 5 seconds threshold

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex justify-center items-center animate-fade-in">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <svg className="animate-spin h-12 w-12 text-sky-600" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-2 w-2 bg-sky-400 rounded-full animate-ping"></div>
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 animate-pulse">
            Loading SplitTrack...
          </p>
          {showLongLoadMsg && (
            <p className="text-sm text-amber-600 dark:text-amber-400 animate-slide-up bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-full border border-amber-200 dark:border-amber-800">
              Taking longer than usual. Please wait...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Loader;