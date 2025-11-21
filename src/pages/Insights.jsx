import { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';

const Insights = () => {
  const { transactions } = useAppStore();

  // --- Rule-Based Smart Insights Logic (Ported from HTML) ---
  const suggestions = useMemo(() => {
      const msgs = [];
      if (transactions.length === 0) return msgs;

      const allDayTotals = new Array(7).fill(0);
      let totalSpend = 0;
      let refundCount = 0;
      let travelSpend = 0;

      transactions.forEach(t => {
          // Weekday Analysis
          if (!t.isReturn && t.timestamp && t.amount > 0) {
              const val = (t.splits?.me || t.amount)/100;
              // Safety check for valid date
              const date = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
              if (!isNaN(date.getTime())) {
                  allDayTotals[date.getDay()] += val;
                  totalSpend += val;
              }
          }
          
          // Refund Count
          if (t.amount < 0 && !t.isReturn) refundCount++;
          
          // Travel Check
          if ((t.category === 'Travel' || t.category === 'Transport') && !t.isReturn) {
              travelSpend += (t.amount/100);
          }
      });

      // Rule 1: Highest Spending Weekday
      const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
      let maxVal = -1; 
      let maxIdx = -1;
      allDayTotals.forEach((val, idx) => { if(val > maxVal){ maxVal = val; maxIdx = idx; } });

      if (maxVal > 0) {
          msgs.push({
              icon: '📅',
              title: 'Weekday Habit',
              text: `Your highest spending day is usually <strong>${days[maxIdx]}</strong>.`
          });
      }

      // Rule 2: Refund Frequency
      if (refundCount > 2) {
          msgs.push({
              icon: '💸',
              title: 'Refunds',
              text: `You've received ${refundCount} refunds recently. Keep tracking!`
          });
      }

      // Rule 3: Travel
      if (totalSpend > 0 && travelSpend > (totalSpend * 0.2)) {
          msgs.push({
              icon: '🚗',
              title: 'On the Move',
              text: `Travel makes up ${Math.round((travelSpend/totalSpend)*100)}% of your total expenses.`
          });
      }
      
      return msgs;
  }, [transactions]);

  // --- Weekly Stats ---
  const weeklyStats = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); 
    const dist = (dayOfWeek + 6) % 7; // Monday start
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dist);
    startOfWeek.setHours(0,0,0,0);

    const weekTxns = transactions.filter(t => {
        if (!t.timestamp) return false;
        const d = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        return d >= startOfWeek;
    });
    
    let total = 0;
    const dayTotals = new Array(7).fill(0);
    const catTotals = {};

    weekTxns.forEach(t => {
      if (t.isReturn) return;
      const val = (t.splits?.me || t.amount || 0) / 100;
      if (val > 0) {
        total += val;
        const d = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
        dayTotals[d.getDay()] += val;
        const cat = t.category || 'Other';
        catTotals[cat] = (catTotals[cat] || 0) + val;
      }
    });

    const daysPassed = (dayOfWeek + 6) % 7 + 1;
    const dailyAvg = total / daysPassed;
    const topDayIndex = dayTotals.indexOf(Math.max(...dayTotals));
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    
    const topCategories = Object.entries(catTotals).sort((a,b) => b[1] - a[1]).slice(0, 5);

    return { total, dailyAvg, topDay: days[topDayIndex], topDayVal: dayTotals[topDayIndex], topCategories };
  }, [transactions]);

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Insights</h2>
      
      {/* Dynamic Suggestions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         {suggestions.length > 0 ? suggestions.map((s, i) => (
             <div key={i} className="bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800 p-4 rounded-lg flex items-start gap-3">
                <div className="text-2xl">{s.icon}</div>
                <div>
                    <h4 className="font-bold text-sky-800 dark:text-sky-300 text-sm uppercase tracking-wide">{s.title}</h4>
                    <p className="text-gray-700 dark:text-gray-300 text-sm mt-1" dangerouslySetInnerHTML={{__html: s.text}}></p>
                </div>
            </div>
         )) : (
             <p className="text-gray-500 col-span-2">Add more transactions to see smart insights!</p>
         )}
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