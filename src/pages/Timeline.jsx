import { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';

const Timeline = () => {
  const { transactions } = useAppStore();

  const groups = useMemo(() => {
    const grouped = {};
    const sorted = [...transactions].sort((a, b) => {
      const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
      const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
      return tB - tA; // Descending order
    });

    sorted.forEach(txn => {
      if (!txn.timestamp) return;
      const dateStr = txn.timestamp.toDate().toDateString();
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(txn);
    });
    return grouped;
  }, [transactions]);

  const todayStr = new Date().toDateString();

  if (transactions.length === 0) return <div className="text-center text-gray-500 mt-10">No timeline data.</div>;

  return (
    // Changed mx-auto max-w-3xl to include responsiveness
    <div className="max-w-3xl mx-auto space-y-8 relative before:absolute before:inset-0 before:ml-4 md:before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-300 before:to-transparent pb-20">
      {/* Adjusted padding left for title */}
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200 mb-8 pl-12 md:pl-12">Timeline</h2>

      {Object.entries(groups).map(([dateStr, txns]) => (
        <div key={dateStr} className="relative">
          {/* Date Header */}
          <div className="sticky top-20 z-20 mb-6 pt-2">
            {/* Blue Dot - Adjusted left position for mobile */}
            <div className="absolute top-1/2 -translate-y-1/2 left-4 md:left-5 -translate-x-1/2 bg-sky-500 h-3 w-3 md:h-4 md:w-4 rounded-full border-2 border-white dark:border-gray-900 z-20 box-content"></div>

            {/* Date Text - Adjusted margin left for mobile */}
            <h3 className="ml-12 md:ml-12 inline-block text-xs sm:text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm relative z-30">
              {dateStr === todayStr ? "Today" : dateStr}
            </h3>
          </div>

          {/* Transactions List - Adjusted margin left for mobile */}
          <div className="ml-12 md:ml-12 space-y-4">
            {txns.map(txn => {
              const isReturn = txn.isReturn;
              const isRefund = txn.amount < 0;
              const isIncome = txn.type === 'income';

              let sign = '-';
              let colorClass = 'text-gray-800 dark:text-gray-200';
              let amountVal = Math.abs(txn.amount / 100);

              if (isRefund || isIncome) {
                sign = '+';
                colorClass = 'text-green-600';
              } else if (isReturn) {
                if (txn.payer === 'me') { sign = '-'; colorClass = 'text-red-600'; }
                else { sign = '+'; colorClass = 'text-green-600'; }
              }

              const myShare = txn.splits?.me ? (txn.splits.me / 100) : 0;
              const shareText = isRefund ? `+₹${Math.abs(myShare).toFixed(2)}` : `₹${myShare.toFixed(2)}`;

              return (
                <div key={txn.id} className="bg-white dark:bg-gray-800 p-3 sm:p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center transition hover:shadow-md relative z-10">
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base truncate">{txn.expenseName}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {txn.category || 'Uncategorized'} • {txn.modeOfPayment || 'Cash'}
                      {txn.place && ` • ${txn.place}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold text-sm sm:text-base ${colorClass}`}>{sign}₹{formatCurrency(amountVal * 100).replace('₹', '')}</p>
                    {myShare !== 0 && !isReturn && !isIncome && (
                      <p className={`text-[10px] sm:text-xs ${isRefund ? 'text-green-600' : 'text-gray-400'}`}>
                        My Share: {shareText}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Timeline;