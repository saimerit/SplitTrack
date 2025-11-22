import { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  PointElement,
  LineElement,
  Filler
} from 'chart.js';
import { Doughnut, Pie, Bar } from 'react-chartjs-2';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import MonthlyTrendLine from '../components/charts/MonthlyTrendLine';
import NetBalanceLine from '../components/charts/NetBalanceLine';
import CategoryDoughnut from '../components/charts/CategoryDoughnut'; 
import { useTheme } from '../hooks/useTheme';

// Register components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title,
  PointElement,
  LineElement,
  Filler
);

const Analytics = () => {
  const { transactions, participantsLookup, loading } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#d1d5db' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const stats = useMemo(() => {
    const monthlyStats = {};
    const categoryStats = {};
    const placeStats = {};
    const participantShareStats = {};
    const currentMonthCatStats = {};
    const heatmapData = {}; 
    const activeDays = new Set();
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayDate = now.getDate();
    
    let myTotalSpending = 0;
    let myTotalRepayment = 0;
    let totalIncome = 0;
    let myCurrentMonthSpending = 0;
    
    const balanceLabels = [];
    const balancePoints = [];
    let runningBalance = 0;

    const getMillis = (t) => {
        if (t?.timestamp?.toMillis) return t.timestamp.toMillis();
        const d = new Date(t?.timestamp);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    
    const sortedTxns = [...transactions].sort((a, b) => getMillis(a) - getMillis(b));

    sortedTxns.forEach(txn => {
      if (!txn.timestamp) return;
      const date = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
      if (isNaN(date.getTime())) return;

      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const day = date.getDate();

      // --- 1. Determine Amounts ---
      let amountIPaid = (txn.payer === 'me') ? (txn.amount / 100) : 0;
      let myConsumption = 0;

      if (txn.type === 'income') {
          const incomeAmt = (txn.amount / 100);
          totalIncome += incomeAmt;
          runningBalance += incomeAmt;
          
          balanceLabels.push(dateStr);
          balancePoints.push(runningBalance);
          return; 
      }

      if (txn.splits && txn.splits['me'] !== undefined) {
          myConsumption = txn.splits['me'] / 100;
      } else if (txn.payer === 'me' && (!txn.splits || Object.keys(txn.splits).length === 0)) {
          myConsumption = (txn.amount / 100);
      }

      runningBalance += (amountIPaid - myConsumption);
      balanceLabels.push(dateStr);
      balancePoints.push(runningBalance);

      // --- 2. Spending Logic ---
      let myShareVal = myConsumption;

      if (Math.abs(myShareVal) < 0.01 && !txn.isReturn) return;

      activeDays.add(date.toDateString());

      if (txn.isReturn) {
          if (txn.payer === 'me') {
              myTotalRepayment += (txn.amount / 100);
          }
      } else {
          myTotalSpending += myShareVal;
          monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + myShareVal;

          const place = txn.place || 'Unknown';
          placeStats[place] = (placeStats[place] || 0) + myShareVal;

          const cat = txn.category || 'Uncategorized';
          categoryStats[cat] = (categoryStats[cat] || 0) + myShareVal;

          if (monthKey === currentMonthKey) {
              myCurrentMonthSpending += myShareVal;
              currentMonthCatStats[cat] = (currentMonthCatStats[cat] || 0) + myShareVal;
              
              if (!heatmapData[cat]) heatmapData[cat] = new Array(32).fill(0);
              if (day >= 1 && day <= 31) heatmapData[cat][day] += myShareVal;
          }

          if (txn.splits) {
              Object.entries(txn.splits).forEach(([uid, sharePaise]) => {
                  const name = uid === 'me' ? 'You' : (participantsLookup.get(uid)?.name || uid);
                  participantShareStats[name] = (participantShareStats[name] || 0) + (sharePaise / 100);
              });
          }
      }
    });

    // --- 3. Aggregations ---
    const monthlyKeys = Object.keys(monthlyStats).sort();
    
    let peakMonth = '-'; 
    let peakAmount = 0;
    monthlyKeys.forEach(k => {
      if (monthlyStats[k] > peakAmount) {
        peakAmount = monthlyStats[k];
        peakMonth = k; 
      }
    });
    if (peakMonth !== '-') {
        const [y, m] = peakMonth.split('-');
        peakMonth = new Date(y, m-1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    const avgMonthly = monthlyKeys.length > 0 ? (myTotalSpending / monthlyKeys.length) : 0;
    
    const monthlyChartLabels = monthlyKeys.map(k => {
        const [y, m] = k.split('-');
        return new Date(y, m-1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    const daysPassed = Math.max(1, todayDate);
    const projectedTotal = (myCurrentMonthSpending / daysPassed) * daysInMonth;
    const forecastPercent = projectedTotal > 0 ? Math.min(100, (myCurrentMonthSpending / projectedTotal) * 100) : 0;

    const sortedCats = Object.entries(categoryStats).sort((a,b) => b[1] - a[1]);
    const sortedPlaces = Object.entries(placeStats).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const sortedCurrentCats = Object.entries(currentMonthCatStats).sort((a,b) => b[1] - a[1]);

    return {
      totalSpend: myTotalSpending,
      totalRepayment: myTotalRepayment,
      totalIncome,
      activeDays: activeDays.size,
      peakMonth,
      peakAmount,
      avgMonthly,
      currentMonthSpend: myCurrentMonthSpending,
      projectedTotal,
      forecastPercent,
      monthlyChart: { labels: monthlyChartLabels, data: monthlyKeys.map(k => monthlyStats[k]) },
      netBalanceChart: { labels: balanceLabels, data: balancePoints },
      categoryData: sortedCats.map(([k, v]) => ({ label: k, value: v })),
      currentMonthBreakdown: sortedCurrentCats,
      participantData: participantShareStats,
      placeData: { labels: sortedPlaces.map(i => i[0]), data: sortedPlaces.map(i => i[1]) },
      heatmapData
    };
  }, [transactions, participantsLookup]);

  if (loading) return <div>Loading analytics...</div>;

  // --- Chart Options & Data Construction ---
  const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
          legend: { position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 11 } } }
      }
  };

  const barOptions = {
      ...commonOptions,
      plugins: { legend: { display: false } },
      scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
  };

  const chartColors = ['#0ea5e9', '#f97316', '#10b981', '#6366f1', '#ec4899', '#f59e0b', '#ef4444'];

  // FIX: Properly construct the Place Bar Chart data object
  const placeChartData = {
      labels: stats.placeData.labels,
      datasets: [{
          label: 'My Spend at Place',
          data: stats.placeData.data,
          backgroundColor: '#6366f1',
          borderRadius: 4
      }]
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Analytics Dashboard</h2>
      
      {/* 1. Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spending (All Time)" value={formatCurrency(stats.totalSpend * 100)} />
        <StatCard title="Highest Spending Month" value={stats.peakMonth} subValue={formatCurrency(stats.peakAmount * 100)} />
        <StatCard title="Avg. Monthly Spending" value={formatCurrency(stats.avgMonthly * 100)} />
        <StatCard title="Active Days" value={stats.activeDays} />
      </div>

      {/* 2. Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="My Monthly Spending">
          <MonthlyTrendLine labels={stats.monthlyChart.labels} data={stats.monthlyChart.data} />
        </ChartCard>
        <ChartCard title="My Net Balance History (Cumulative)">
          <NetBalanceLine labels={stats.netBalanceChart.labels} data={stats.netBalanceChart.data} />
        </ChartCard>
      </div>

      {/* 3. Breakdown Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Expense vs Repayment">
            <Doughnut 
                data={{
                    labels: ['My Expenses', 'My Repayments', 'Income'],
                    datasets: [{
                        data: [stats.totalSpend, stats.totalRepayment, stats.totalIncome],
                        backgroundColor: ['#f43f5e', '#10b981', '#3b82f6'], 
                        borderColor: isDark ? '#1f2937' : '#ffffff',
                        borderWidth: 2
                    }]
                }} 
                options={commonOptions} 
            />
        </ChartCard>
        
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">My Spending by Category</h3>
            <div className="h-64 relative">
                {stats.categoryData.length > 0 ? (
                    <CategoryDoughnut data={stats.categoryData} />
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">No data</div>
                )}
            </div>
        </div>
      </div>

      {/* 4. Secondary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <ChartCard title="Spending by Participant (Share)">
             <Pie 
                data={{
                    labels: Object.keys(stats.participantData),
                    datasets: [{
                        data: Object.values(stats.participantData),
                        backgroundColor: chartColors,
                        borderColor: isDark ? '#1f2937' : '#ffffff',
                        borderWidth: 2
                    }]
                }} 
                options={commonOptions} 
             />
         </ChartCard>
         
         <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
             <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Spending by Place</h3>
             <div className="h-64 relative">
                 {/* FIX: Passed the correctly constructed chart data object */}
                 <Bar data={placeChartData} options={barOptions} />
             </div>
         </div>
      </div>

      {/* 5. Forecast & Heatmap Row */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Spending Forecast (Current Month)</h3>
        <div className="relative pt-1">
            <div className="flex mb-2 items-center justify-between">
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-sky-600 bg-sky-200 dark:text-sky-200 dark:bg-sky-900">
                    On track for {formatCurrency(stats.projectedTotal * 100)}
                </span>
                <span className="text-xs font-semibold inline-block text-sky-600 dark:text-sky-400">
                    {Math.round(stats.forecastPercent)}%
                </span>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-sky-200 dark:bg-gray-700">
                <div style={{ width: `${stats.forecastPercent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-sky-500 transition-all duration-500"></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Based on your daily average this month, you are projected to spend <span className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(stats.projectedTotal * 100)}</span> by month end.
            </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Where Did My Month Go?</h3>
            <div className="space-y-3 max-h-80 overflow-y-auto no-scrollbar">
                {stats.currentMonthBreakdown.length > 0 ? (
                    stats.currentMonthBreakdown.map(([cat, amount]) => {
                        const percent = ((amount / stats.currentMonthSpend) * 100).toFixed(1);
                        return (
                            <div key={cat} className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{cat}</p>
                                    <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 dark:bg-gray-700">
                                        <div className="h-1.5 bg-sky-500 rounded-full" style={{ width: `${percent}%` }}></div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{percent}%</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(amount * 100)}</p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-sm text-gray-500">No spending this month yet.</p>
                )}
            </div>
        </div>

        <HeatmapPanel data={stats.heatmapData} />
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subValue }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
    <div className="text-2xl font-bold text-gray-800 dark:text-gray-200 mt-2">{value}</div>
    {subValue && <div className="text-sm text-gray-500 dark:text-gray-400">{subValue}</div>}
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
    <div className="relative h-64">
      {children}
    </div>
  </div>
);

const HeatmapPanel = ({ data }) => {
  const cats = Object.keys(data);
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Category Intensity Heatmap</h3>
        <p className="text-xs text-gray-500 mb-2">Darker color = Higher spending</p>
        {cats.length === 0 ? (
            <p className="text-gray-500">No data this month.</p>
        ) : (
            <div className="grid gap-1 overflow-x-auto pb-2" style={{ gridTemplateColumns: 'auto repeat(31, minmax(10px, 1fr))' }}>
                <div className="text-xs font-bold text-gray-500">Cat</div>
                {[...Array(31)].map((_, i) => (<div key={i} className="text-[9px] text-center text-gray-400">{i+1}</div>))}
                {cats.map(cat => {
                    const maxDaily = Math.max(...data[cat]);
                    return (
                        <>
                           <div key={`label-${cat}`} className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate pr-2">{cat.substring(0,10)}</div>
                           {[...Array(31)].map((_, i) => {
                               const val = data[cat][i+1];
                               const opacity = val > 0 ? Math.max(0.3, val / (maxDaily || 1)) : 0.1;
                               return (<div key={`${cat}-${i}`} title={`${cat}: ${val.toFixed(2)}`} className={`h-3 w-full rounded-sm ${val > 0 ? 'bg-sky-600' : 'bg-gray-100 dark:bg-gray-700'}`} style={{ opacity: val > 0 ? opacity : 1 }} />);
                           })}
                        </>
                    );
                })}
            </div>
        )}
    </div>
  );
};

export default Analytics;