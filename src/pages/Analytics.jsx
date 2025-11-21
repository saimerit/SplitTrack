import { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import MonthlyTrendLine from '../components/charts/MonthlyTrendLine';
import NetBalanceLine from '../components/charts/NetBalanceLine';
import CategoryDoughnut from '../components/charts/CategoryDoughnut';

const Analytics = () => {
  const { transactions, loading } = useAppStore();

  const stats = useMemo(() => {
    const monthlyStats = {};
    const placeStats = {};
    const categoryStats = {};
    const currentMonthCatStats = {};
    const heatmapData = {}; 
    const activeDays = new Set();
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let totalSpend = 0;
    let currentMonthSpend = 0;
    
    const balanceLabels = [];
    const balancePoints = [];
    let runningBalance = 0;

    // SAFETY: Handle mixed date formats robustly
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

      let amountIPaid = (txn.payer === 'me') ? (txn.amount / 100) : 0;
      let myConsumption = 0;
      
      if (txn.type === 'income') {
          amountIPaid = (txn.amount / 100);
      } else if (txn.splits && txn.splits['me'] !== undefined) {
          myConsumption = txn.splits['me'] / 100;
      }

      runningBalance += (amountIPaid - myConsumption);
      balanceLabels.push(dateStr);
      balancePoints.push(runningBalance);

      if (txn.type === 'expense' && myConsumption > 0) {
        totalSpend += myConsumption;
        activeDays.add(date.toDateString());

        monthlyStats[monthKey] = (monthlyStats[monthKey] || 0) + myConsumption;
        
        const place = txn.place || 'Unknown';
        placeStats[place] = (placeStats[place] || 0) + myConsumption;

        const cat = txn.category || 'Uncategorized';
        categoryStats[cat] = (categoryStats[cat] || 0) + myConsumption;

        if (monthKey === currentMonthKey) {
          currentMonthSpend += myConsumption;
          currentMonthCatStats[cat] = (currentMonthCatStats[cat] || 0) + myConsumption;
          
          if (!heatmapData[cat]) heatmapData[cat] = new Array(32).fill(0);
          heatmapData[cat][day] += myConsumption;
        }
      }
    });

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

    return {
      totalSpend,
      activeDays: activeDays.size,
      peakMonth,
      peakAmount,
      avgMonthly,
      currentMonthSpend,
      currentMonthCatStats,
      heatmapData,
      monthlyChart: { labels: monthlyChartLabels, data: monthlyKeys.map(k => monthlyStats[k]) },
      netBalanceChart: { labels: balanceLabels, data: balancePoints },
      categoryData: Object.entries(categoryStats).map(([k, v]) => ({ label: k, value: v }))
    };
  }, [transactions]);

  if (loading) return <div>Loading analytics...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Analytics Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Spending (All Time)" value={formatCurrency(stats.totalSpend * 100)} />
        <StatCard title="Highest Spending Month" value={stats.peakMonth} subValue={formatCurrency(stats.peakAmount * 100)} />
        <StatCard title="Avg. Monthly Spending" value={formatCurrency(stats.avgMonthly * 100)} />
        <StatCard title="Active Days" value={stats.activeDays} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Monthly Spending Trend">
          <MonthlyTrendLine labels={stats.monthlyChart.labels} data={stats.monthlyChart.data} />
        </ChartCard>
        <ChartCard title="Net Balance History">
          <NetBalanceLine labels={stats.netBalanceChart.labels} data={stats.netBalanceChart.data} />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Spending by Category</h3>
            <div className="h-64 relative">
                <CategoryDoughnut data={stats.categoryData} />
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
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Intensity Heatmap</h3>
        <p className="text-xs text-gray-500 mb-2">Current Month (Day 1-31)</p>
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