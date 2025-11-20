import { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';

const Insights = () => {
  const { transactions } = useAppStore();

  const weeklyStats = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); 
    const dist = (dayOfWeek + 6) % 7; // Monday start
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dist);
    startOfWeek.setHours(0,0,0,0);

    const weekTxns = transactions.filter(t => t.timestamp && t.timestamp.toDate() >= startOfWeek);
    
    let total = 0;
    const dayTotals = new Array(7).fill(0);
    const catTotals = {};

    weekTxns.forEach(t => {
      if (t.isReturn) return;
      const val = (t.splits?.me || t.amount || 0) / 100;
      if (val > 0) {
        total += val;
        dayTotals[t.timestamp.toDate().getDay()] += val;
        catTotals[t.category || 'Other'] = (catTotals[t.category || 'Other'] || 0) + val;
      }
    });

    const daysPassed = (dayOfWeek + 6) % 7 + 1;
    const dailyAvg = total / daysPassed;

    const topDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    
    const topCategories = Object.entries(catTotals)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5);

    return { total, dailyAvg, topDay: days[topDayIndex], topDayVal: dayTotals[topDayIndex], topCategories };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Insights</h2>
      
      {/* Smart Suggestions (Static for now, logic is in HTML 4650) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-4 rounded-lg flex items-start gap-3">
            <div className="text-2xl">📅</div>
            <div>
                <h4 className="font-bold text-sky-800 dark:text-sky-300 text-sm uppercase tracking-wide">Weekly Snapshot</h4>
                <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">
                    You've spent <strong>{formatCurrency(weeklyStats.total * 100)}</strong> this week.
                </p>
            </div>
        </div>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">This Week's Snapshot</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
            <p className="text-sm text-gray-500">Total Spent</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{formatCurrency(weeklyStats.total * 100)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
            <p className="text-sm text-gray-500">Daily Average</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">{formatCurrency(weeklyStats.dailyAvg * 100)}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow border dark:border-gray-700">
            <p className="text-sm text-gray-500">Top Spending Day</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100 mt-1">
                {weeklyStats.topDay} <span className="text-sm font-normal text-gray-500">({formatCurrency(weeklyStats.topDayVal * 100)})</span>
            </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
         <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Categories This Week</h4>
         <div className="space-y-3">
            {weeklyStats.topCategories.map(([cat, val]) => (
                <div key={cat} className="flex justify-between items-center">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{cat}</span>
                    <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden dark:bg-gray-700">
                            <div className="h-full bg-sky-500" style={{ width: `${(val / weeklyStats.total) * 100}%` }}></div>
                        </div>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">₹{Math.round(val)}</span>
                    </div>
                </div>
            ))}
            {weeklyStats.topCategories.length === 0 && <p className="text-sm text-gray-500">No spending this week.</p>}
         </div>
      </div>
    </div>
  );
};

export default Insights;