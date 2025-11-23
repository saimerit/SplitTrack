import { useState, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import Select from '../components/common/Select';

const Calendar = () => {
  const { transactions } = useAppStore();
  const now = new Date();
  
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const calendarData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, parseInt(selectedMonth) + 1, 0).getDate();
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay(); 
    
    const dailyTotals = new Array(daysInMonth + 1).fill(0);
    let maxDailySpend = 0;

    transactions.forEach(txn => {
      if (!txn.timestamp) return;
      
      // --- FIX: Safe Date Parsing with Optional Catch Binding ---
      let d;
      try {
        d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
      } catch {
        // Fixed: Removed (e) to satisfy ESLint "no-unused-vars"
        return; // Skip invalid dates
      }
      
      if (isNaN(d.getTime())) return;
      // ----------------------------------------------------------

      if (d.getFullYear() === parseInt(selectedYear) && d.getMonth() === parseInt(selectedMonth) && !txn.isReturn) {
        const val = (txn.splits?.me || txn.amount || 0) / 100;
        dailyTotals[d.getDate()] += val;
      }
    });

    maxDailySpend = Math.max(...dailyTotals);

    return { daysInMonth, firstDayIndex, dailyTotals, maxDailySpend };
  }, [transactions, selectedMonth, selectedYear]);

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Cash Flow Calendar</h2>
        <div className="flex gap-2">
          <Select 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)} 
            options={months.map((m, i) => ({ value: i, label: m }))}
            className="w-32"
          />
          <Select 
            value={selectedYear} 
            onChange={e => setSelectedYear(e.target.value)} 
            options={years.map(y => ({ value: y, label: y }))}
            className="w-24"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 overflow-x-auto">
        <div className="grid grid-cols-7 gap-1 min-w-[600px]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center font-bold text-gray-500 dark:text-gray-400 p-2">{day}</div>
          ))}

          {[...Array(calendarData.firstDayIndex)].map((_, i) => (
            <div key={`empty-${i}`} className="h-24 bg-gray-50/30 dark:bg-gray-800/30"></div>
          ))}

          {[...Array(calendarData.daysInMonth)].map((_, i) => {
            const day = i + 1;
            const total = calendarData.dailyTotals[day];
            const intensity = calendarData.maxDailySpend > 0 ? (total / calendarData.maxDailySpend) : 0;
            
            let bgStyle = {};
            let textClass = 'text-gray-700 dark:text-gray-300';

            if (total > 0) {
               const alpha = 0.1 + (intensity * 0.8);
               bgStyle = { backgroundColor: `rgba(239, 68, 68, ${alpha})` };
               if (alpha > 0.5) textClass = 'text-white font-bold';
            } else if (total < 0) {
               bgStyle = { backgroundColor: 'rgba(34, 197, 94, 0.2)' };
            }

            return (
              <div 
                key={day} 
                className={`h-24 border border-gray-200 dark:border-gray-700 p-1 flex flex-col justify-between transition hover:scale-105`}
                style={bgStyle}
              >
                <span className={`text-xs font-semibold ${textClass}`}>{day}</span>
                {total !== 0 && (
                  <span className={`text-xs ${textClass} text-right break-all`}>
                    ₹{Math.round(total)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Calendar;