import { useMemo } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title
} from 'chart.js';
import { Doughnut, Pie, Bar } from 'react-chartjs-2';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import MonthlyTrendLine from '../components/charts/MonthlyTrendLine';
import NetBalanceLine from '../components/charts/NetBalanceLine';
import CategoryDoughnut from '../components/charts/CategoryDoughnut'; // Fixed: Added missing import
import { useTheme } from '../hooks/useTheme';

// Register all necessary Chart.js components
ChartJS.register(
  ArcElement, 
  Tooltip, 
  Legend, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title
);

const Analytics = () => {
  const { transactions, participantsLookup, loading } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Chart Theme Colors
  const textColor = isDark ? '#d1d5db' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const stats = useMemo(() => {
    const monthlyStats = {};
    const categoryStats = {};
    const placeStats = {};
    const participantShareStats = {};
    
    // Feature Variables
    const currentMonthCatStats = {};
    const heatmapData = {}; 
    const activeDays = new Set();
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let totalSpend = 0;
    let totalRepayment = 0;
    let totalIncome = 0;
    let totalLent = 0;
    let currentMonthSpend = 0;
    
    const balanceLabels = [];
    const balancePoints = [];
    let runningBalance = 0;

    const getMillis = (t) => {
        if (t?.timestamp?.toMillis) return t.timestamp.toMillis();
        const d = new Date(t?.timestamp);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    
    // Sort ascending for cumulative charts
    const sortedTxns = [...transactions].sort((a, b) => getMillis(a) - getMillis(b));

    sortedTxns.forEach(txn => {
      if (!txn.timestamp) return;
      
      const date = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
      if (isNaN(date.getTime())) return;

      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const day = date.getDate();

      // --- 1. Balances & Income ---
      let amountIPaid = (txn.payer === 'me') ? (txn.amount / 100) : 0;
      let myConsumption = 0;
      
      if (txn.type === 'income') {
          amountIPaid = (txn.amount / 100);
          totalIncome += amountIPaid;
      } else if (txn.splits && txn.splits['me'] !== undefined) {
          myConsumption = txn.splits['me'] / 100;
      }

      runningBalance += (amountIPaid - myConsumption);
      balanceLabels.push(dateStr);
      balancePoints.push(runningBalance);

      // --- 2. Spending & Consumption Analysis ---
      if (txn.type === 'expense') {
          // Track what I paid for others (Lent)
          if (txn.payer === 'me') {
              const lent = amountIPaid - myConsumption;
              if (lent > 0) totalLent += lent;
          }

          // Only track my consumption for spending stats
          if (myConsumption > 0) {
            totalSpend += myConsumption;
            activeDays.add(date.toDateString());
    
            monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + myConsumption;
            
            const place = txn.place || 'Unknown';
            placeStats[place] = (placeStats[place] || 0) + myConsumption;
    
            const cat = txn.category || 'Uncategorized';
            categoryStats[cat] = (categoryStats[cat] || 0) + myConsumption;
    
            // Current Month Logic
            if (monthKey === currentMonthKey) {
              currentMonthSpend += myConsumption;
              currentMonthCatStats[cat] = (currentMonthCatStats[cat] || 0) + myConsumption;
              if (!heatmapData[cat]) heatmapData[cat] = new Array(32).fill(0);
              heatmapData[cat][day] += myConsumption;
            }
          }
      }

      // --- 3. Repayments ---
      if (txn.isReturn && txn.payer === 'me') {
          totalRepayment += (txn.amount / 100);
      }

      // --- 4. Participant Shares (Who is consuming?) ---
      if (txn.splits && !txn.isReturn && txn.type !== 'income') {
          Object.entries(txn.splits).forEach(([uid, sharePaise]) => {
              const name = uid === 'me' ? 'You' : (participantsLookup.get(uid)?.name || uid);
              participantShareStats[name] = (participantShareStats[name] || 0) + (sharePaise / 100);
          });
      }
    });

    // Process Monthly Stats for Charts
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
    const avgMonthly = monthlyKeys.length > 0 ? (totalSpend / monthlyKeys.length) : 0;
    const monthlyChartLabels = monthlyKeys.map(k => {
        const [y, m] = k.split('-');
        return new Date(y, m-1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    // Forecast Logic
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const projectedTotal = (currentMonthSpend / daysPassed) * daysInMonth;
    const forecastPercent = projectedTotal > 0 ? Math.min(100, (currentMonthSpend / projectedTotal) * 100) : 0;

    // Sort Aggregates
    const sortedCats = Object.entries(categoryStats).sort((a,b) => b[1] - a[1]);
    const sortedPlaces = Object.entries(placeStats).sort((a,b) => b[1] - a[1]).slice(0, 10);

    return {
      totalSpend,
      totalLent,
      totalRepayment,
      totalIncome,
      activeDays: activeDays.size,
      peakMonth,
      peakAmount,
      avgMonthly,
      currentMonthSpend,
      projectedTotal,
      forecastPercent,
      heatmapData,
      monthlyChart: { labels: monthlyChartLabels, data: monthlyKeys.map(k => monthlyStats[k]) },
      netBalanceChart: { labels: balanceLabels, data: balancePoints },
      categoryData: sortedCats.map(([k, v]) => ({ label: k, value: v })),
      participantData: participantShareStats,
      placeData: { labels: sortedPlaces.map(i => i[0]), data: sortedPlaces.map(i => i[1]) }
    };
  }, [transactions, participantsLookup]);

  if (loading) return <div>Loading analytics...</div>;

  // --- CHART CONFIGS ---
  const chartColors = ['#0ea5e9', '#f97316', '#10b981', '#6366f1', '#ec4899', '#f59e0b', '#ef4444'];

  // 1. Expense vs Repayment vs Income
  const typeData = {
      labels: ['My Expenses', 'My Repayments', 'Income'],
      datasets: [{
          data: [stats.totalSpend, stats.totalRepayment, stats.totalIncome],
          backgroundColor: ['#f43f5e', '#10b981', '#3b82f6'], // Red, Green, Blue
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2
      }]
  };

  // 2. Participant Share
  const partLabels = Object.keys(stats.participantData);
  const partValues = Object.values(stats.participantData);
  const partData = {
      labels: partLabels,
      datasets: [{
          data: partValues,
          backgroundColor: chartColors,
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2
      }]
  };

  // 3. Places Bar
  const placeData = {
      labels: stats.placeData.labels,
      datasets: [{
          label: 'My Spend at Place',
          data: stats.placeData.data,
          backgroundColor: '#6366f1', // Indigo
          borderRadius: 4
      }]
  };

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

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Analytics Dashboard</h2>
      
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spending (All Time)" value={formatCurrency(stats.totalSpend * 100)} />
        <StatCard title="Highest Spending Month" value={stats.peakMonth} subValue={formatCurrency(stats.peakAmount * 100)} />
        <StatCard title="Avg. Monthly Spending" value={formatCurrency(stats.avgMonthly * 100)} />
        <StatCard title="Active Days" value={stats.activeDays} />
      </div>

      {/* Row 1: Line Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="My Monthly Spending">
          <MonthlyTrendLine labels={stats.monthlyChart.labels} data={stats.monthlyChart.data} />
        </ChartCard>
        <ChartCard title="My Net Balance History (Cumulative)">
          <NetBalanceLine labels={stats.netBalanceChart.labels} data={stats.netBalanceChart.data} />
        </ChartCard>
      </div>

      {/* Row 2: Expense Type & Categories (Grid of 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Expense vs Repayment">
            <Doughnut data={typeData} options={commonOptions} />
        </ChartCard>
        
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">My Spending by Category</h3>
            <div className="h-64 relative">
                <CategoryDoughnut data={stats.categoryData} />
            </div>
        </div>
      </div>

      {/* Row 3: Participants & Places (Grid of 3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <ChartCard title="Spending by Participant (Share)">
             <Pie data={partData} options={commonOptions} />
         </ChartCard>
         
         <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
             <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Spending by Place</h3>
             <div className="h-64 relative">
                 <Bar data={placeData} options={barOptions} />
             </div>
         </div>
      </div>

      {/* Row 4: Forecast & Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <ForecastCard 
            spent={stats.currentMonthSpend} 
            projected={stats.projectedTotal} 
            percent={stats.forecastPercent} 
         />
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

const ForecastCard = ({ spent, projected, percent }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Spending Forecast (Current Month)</h3>
        <div className="relative pt-4">
            <div className="flex mb-2 items-center justify-between">
                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-sky-600 bg-sky-200 dark:text-sky-200 dark:bg-sky-900">
                    SPENT {formatCurrency(spent * 100)}
                </span>
                <span className="text-xs font-semibold inline-block text-sky-600 dark:text-sky-400">
                    {Math.round(percent)}% of projection
                </span>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-sky-200 dark:bg-gray-700">
                <div style={{ width: `${percent}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-sky-500 transition-all duration-500"></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
                Based on your daily average this month, you are projected to spend <span className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(projected * 100)}</span> by month end.
            </p>
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