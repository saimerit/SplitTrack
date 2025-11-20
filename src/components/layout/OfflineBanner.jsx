import { WifiOff } from 'lucide-react';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

const OfflineBanner = () => {
  const { queueLength, syncQueue, isSyncing } = useOfflineQueue();

  if (queueLength === 0) return null;

  return (
    <div 
      onClick={syncQueue}
      className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4 cursor-pointer animate-pulse"
    >
      <div className="flex items-center gap-2 font-bold">
        <WifiOff size={16} /> <span>Offline Mode</span>
      </div>
      <p className="text-xs mt-1">
        {isSyncing 
          ? 'Syncing data to cloud...' 
          : `${queueLength} transaction(s) saved locally. Click to sync now.`}
      </p>
    </div>
  );
};

export default OfflineBanner;