import { renderHook, act} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOfflineQueue } from './useOfflineQueue';
import { setDoc } from 'firebase/firestore';

// --- Mocks ---
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(() => 'mock-doc-ref'),
  setDoc: vi.fn(),
  Timestamp: { fromMillis: (ms) => ms } // Simple pass-through for test
}));

vi.mock('../config/firebase', () => ({
  db: {}
}));

// Mock Store Toast
const mockShowToast = vi.fn();
vi.mock('../store/useAppStore', () => ({
  default: () => ({ showToast: mockShowToast })
}));

describe('useOfflineQueue Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with zero queue length', () => {
    const { result } = renderHook(() => useOfflineQueue());
    expect(result.current.queueLength).toBe(0);
  });

  it('should add transaction to localStorage queue', () => {
    const { result } = renderHook(() => useOfflineQueue());
    
    const txnData = { amount: 100, expenseName: 'Offline Txn' };
    
    act(() => {
      result.current.addToQueue(txnData);
    });

    expect(result.current.queueLength).toBe(1);
    const stored = JSON.parse(localStorage.getItem('splitTrack_offline_queue'));
    expect(stored).toHaveLength(1);
    expect(stored[0].expenseName).toBe('Offline Txn');
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Saved offline'), false);
  });

  it('should sync queue to firestore and clear local storage', async () => {
    // Seed LocalStorage
    const offlineItem = { id: 'offline-1', amount: 500, timestamp: 1234567890 };
    localStorage.setItem('splitTrack_offline_queue', JSON.stringify([offlineItem]));

    const { result } = renderHook(() => useOfflineQueue());
    
    // Mock successful firestore write
    setDoc.mockResolvedValueOnce(true);

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(result.current.queueLength).toBe(0);
    expect(localStorage.getItem('splitTrack_offline_queue')).toBe('[]');
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Successfully synced'), false);
  });

  it('should handle sync failure by keeping item in queue', async () => {
    // Seed LocalStorage
    const offlineItem = { id: 'fail-1', amount: 500, timestamp: 1234567890 };
    localStorage.setItem('splitTrack_offline_queue', JSON.stringify([offlineItem]));

    const { result } = renderHook(() => useOfflineQueue());
    
    // Mock FAILED firestore write
    setDoc.mockRejectedValueOnce(new Error("Network Error"));

    await act(async () => {
      await result.current.syncQueue();
    });

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(result.current.queueLength).toBe(1); // Still in queue
    const stored = JSON.parse(localStorage.getItem('splitTrack_offline_queue'));
    expect(stored).toHaveLength(1);
    expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('Failed 1'), true);
  });
});