import { WifiOff, RefreshCw, Cloud } from 'lucide-react';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

const OfflineBanner = () => {
  const { queueLength, syncQueue, isSyncing, syncProgress } = useOfflineQueue();

  if (queueLength === 0) return null;

  return (
    <div
      onClick={syncQueue}
      className="glass-card p-3 mb-4 cursor-pointer border border-amber-500/30 hover:border-amber-500/50 transition-colors haptic-tap"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isSyncing ? (
            <RefreshCw size={16} className="text-amber-400 animate-spin" />
          ) : (
            <WifiOff size={16} className="text-amber-400" />
          )}
          <span className="text-sm font-semibold text-amber-400">
            {isSyncing ? 'Syncing...' : 'Offline Mode'}
          </span>
        </div>
        <Cloud size={14} className="text-amber-400/60" />
      </div>

      {/* Progress Bar */}
      {isSyncing && syncProgress ? (
        <div className="mb-2">
          <div className="h-1.5 bg-amber-500/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-300"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-amber-400/60 mt-1 text-right tabular-nums">
            {syncProgress.current} / {syncProgress.total}
          </p>
        </div>
      ) : (
        <div className="sync-progress-bar h-1 rounded-full mb-2" />
      )}

      {/* Message */}
      <p className="text-xs text-gray-400">
        {isSyncing
          ? 'Uploading transactions to cloud...'
          : `${queueLength} transaction${queueLength > 1 ? 's' : ''} queued. Tap to sync.`}
      </p>
    </div>
  );
};

export default OfflineBanner;