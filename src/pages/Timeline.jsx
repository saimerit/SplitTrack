import { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';

const Timeline = () => {
  // Fix 1: Removed participantsLookup from destructuring
  const { transactions } = useAppStore();

  const groups = useMemo(() => {
    const grouped = {};
    const sorted = [...transactions].sort((a, b) => b.timestamp - a.timestamp);

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
    <div className="max-w-3xl mx-auto space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-300 before:to-transparent">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-8 pl-6 md:pl-0">Timeline</h2>
      
      {Object.entries(groups).map(([dateStr, txns]) => (
        <div key={dateStr} className="relative">
          <div className="sticky top-0 z-10 mb-4 flex items-center md:justify-center">
            <div className="absolute left-0 md:left-1/2 -translate-x-1.5 bg-sky-500 h-4 w-4 rounded-full border-2 border-white dark:border-gray-900"></div>
            <h3 className="ml-8 md:ml-0 text-sm font-bold text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded border dark:border-gray-700 shadow-sm">
              {dateStr === todayStr ? "Today" : dateStr}
            </h3>
          </div>

          <div className="ml-8 md:ml-0 space-y-4">
            {txns.map(txn => {
              // Fix 2: Define isReturn
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
                <div key={txn.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex justify-between items-center transition hover:shadow-md">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{txn.expenseName}</p>
                    <p className="text-xs text-gray-500">
                      {txn.category || 'Uncategorized'} • {txn.modeOfPayment || 'Cash'}
                      {txn.place && ` • ${txn.place}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${colorClass}`}>{sign}₹{formatCurrency(amountVal * 100).replace('₹','')}</p>
                    {myShare !== 0 && !isReturn && !isIncome && (
                      <p className={`text-xs ${isRefund ? 'text-green-600' : 'text-gray-400'}`}>
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