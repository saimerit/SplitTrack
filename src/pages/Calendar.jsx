import { useState, useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import Select from '../components/common/Select';

const Calendar = () => {
  const { transactions } = useAppStore();
  const now = new Date();

  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Track animation direction: 'next' (slide-in-right) or 'prev' (slide-in-left)
  const [slideDirection, setSlideDirection] = useState('next');

  // --- Swipe Logic State ---
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e) => {
    setTouchEnd(null);
    // CHANGE: Track X axis instead of Y
    setTouchStart(e.targetTouches[0].clientX);
  }

  const onTouchMove = (e) => {
    // CHANGE: Track X axis
    setTouchEnd(e.targetTouches[0].clientX);
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe Left -> Next Month
      changeMonth(1);
    } else if (isRightSwipe) {
      // Swipe Right -> Prev Month
      changeMonth(-1);
    }
  }

  const changeMonth = (increment) => {
    // Determine animation direction based on increment
    setSlideDirection(increment > 0 ? 'next' : 'prev');

    let newMonth = parseInt(selectedMonth) + increment;
    let newYear = parseInt(selectedYear);

    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }

    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };
  // -------------------------

  const calendarData = useMemo(() => {
    const daysInMonth = new Date(selectedYear, parseInt(selectedMonth) + 1, 0).getDate();
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay();

    const dailyTotals = new Array(daysInMonth + 1).fill(0);
    let maxDailySpend = 0;

    transactions.forEach(txn => {
      if (!txn.timestamp) return;
      let d;
      try { d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp); } catch { return; }
      if (isNaN(d.getTime())) return;

      if (d.getFullYear() === parseInt(selectedYear) && d.getMonth() === parseInt(selectedMonth) && !txn.isReturn) {
        const val = (txn.splits?.me || txn.amount || 0) / 100;
        dailyTotals[d.getDate()] += val;
      }
    });

    maxDailySpend = Math.max(...dailyTotals);
    return { daysInMonth, firstDayIndex, dailyTotals, maxDailySpend };
  }, [transactions, selectedMonth, selectedYear]);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const years = useMemo(() => {
    const y = parseInt(selectedYear);
    const list = [y - 2, y - 1, y, y + 1, y + 2];
    return [...new Set(list)].sort((a, b) => a - b);
  }, [selectedYear]);

  return (
    <div
      className="space-y-6 pb-20 touch-pan-y overscroll-x-none max-w-4xl mx-auto"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="glass-card p-6 md:p-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-orange-400 to-red-400">Cash Flow</h2>
            <p className="text-gray-400 mt-1">Daily spending heatmap</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select
              value={selectedMonth}
              onChange={e => setSelectedMonth(parseInt(e.target.value))}
              options={months.map((m, i) => ({ value: i, label: m }))}
              className="flex-1 sm:w-32"
            />
            <Select
              value={selectedYear}
              onChange={e => setSelectedYear(parseInt(e.target.value))}
              options={years.map(y => ({ value: y, label: y }))}
              className="flex-1 sm:w-24"
            />
          </div>
        </div>
      </div>

      {/* Key forces remount on month/year change to trigger animation */}
      <div
        key={`${selectedYear}-${selectedMonth}`}
        className={`glass-card p-2 sm:p-4 select-none ${slideDirection === 'next' ? 'animate-slide-in-right' : 'animate-slide-in-left'
          }`}
      >
        <div className="grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <div key={i} className="text-center font-bold text-gray-400 p-2 text-xs sm:text-sm">{day}</div>
          ))}

          {[...Array(calendarData.firstDayIndex)].map((_, i) => (
            <div key={`empty-${i}`} className="h-14 sm:h-24 bg-gray-50/30 dark:bg-gray-800/30"></div>
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
                className="h-14 sm:h-24 border border-gray-200 dark:border-gray-700 p-1 flex flex-col justify-between transition hover:scale-105 rounded-sm"
                style={bgStyle}
              >
                <span className={`text-[10px] sm:text-xs font-semibold ${textClass}`}>{day}</span>
                {total !== 0 && (
                  <span className={`text-[9px] sm:text-xs ${textClass} text-right break-all leading-tight`}>
                    <span className="hidden sm:inline">₹</span>{Math.round(total)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs text-gray-400 mt-2 sm:hidden animate-fade-in">
        Swipe left/right to change month
      </div>
    </div>
  );
};

export default Calendar;