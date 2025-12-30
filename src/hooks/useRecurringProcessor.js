import { useEffect, useRef } from 'react';
import useAppStore from '../store/useAppStore';
import { checkDueRecurring, processRecurringTransaction } from '../services/transactionService';

/**
 * Hook to automatically process due recurring transactions on app load.
 * Runs once when the app loads and processes all due items silently.
 */
export const useRecurringProcessor = () => {
    const hasProcessed = useRef(false);
    const { loading, showToast } = useAppStore();

    useEffect(() => {
        // Only run once when app is ready (loading = false)
        if (loading || hasProcessed.current) return;

        const processAllDueRecurring = async () => {
            try {
                const dueItems = await checkDueRecurring();

                if (!dueItems || dueItems.length === 0) {
                    console.log('[RecurringProcessor] No due items found.');
                    return;
                }

                console.log(`[RecurringProcessor] Found ${dueItems.length} due recurring item(s).`);
                let processedCount = 0;

                for (const item of dueItems) {
                    try {
                        await processRecurringTransaction(item.id, item);
                        processedCount++;
                        console.log(`[RecurringProcessor] Processed: ${item.name}`);
                    } catch (err) {
                        console.error(`[RecurringProcessor] Failed to process ${item.name}:`, err);
                    }
                }

                if (processedCount > 0) {
                    showToast(`Auto-logged ${processedCount} recurring transaction${processedCount > 1 ? 's' : ''}!`);
                }
            } catch (err) {
                console.error('[RecurringProcessor] Error checking recurring:', err);
            }
        };

        hasProcessed.current = true;
        processAllDueRecurring();
    }, [loading, showToast]);
};
