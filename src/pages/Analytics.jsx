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

// Register ALL components
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
    // 1. Setup Data Structures
    const monthlySpendStats = {}; 
    const monthlyLentStats = {};  
    const monthlyReceivedStats = {};
    
    const categoryStats = {};
    const placeStats = {};
    const participantShareStats = {};
    
    const currentMonthCatStats = {};
    const heatmapData = new Array(32).fill(0); 
    const activeDays = new Set();
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let totalSpend = 0;     
    let totalLent = 0;      
    let totalRepaymentSent = 0; // I paid someone back
    let totalReceived = 0;      // Someone paid me back
    let totalIncome = 0;
    
    let currentMonthSpend = 0;
    let currentMonthLent = 0;
    
    const balanceLabels = [];
    const balancePoints = [];
    let runningBalance = 0;

    const getMillis = (t) => {
        if (t?.timestamp?.toMillis) return t.timestamp.toMillis();
        const d = new Date(t?.timestamp);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    
    const sortedTxns = [...transactions].sort((a, b) => getMillis(a) - getMillis(b));

    // 2. Process Transactions
    sortedTxns.forEach(txn => {
      if (!txn.timestamp) return;
      const date = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
      if (isNaN(date.getTime())) return;

      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const day = date.getDate();

      // --- Calculate Base Amounts ---
      let amountIPaid = (txn.payer === 'me') ? (txn.amount / 100) : 0;
      let myConsumption = 0;
      
      if (txn.type === 'income') {
          amountIPaid = (txn.amount / 100); 
          totalIncome += amountIPaid;
      } else if (txn.splits && txn.splits['me'] !== undefined) {
          myConsumption = txn.splits['me'] / 100;
      } else if (txn.payer === 'me' && (!txn.splits || Object.keys(txn.splits).length === 0)) {
          // Legacy Fallback
          if (txn.participants && txn.participants.length > 0) {
             myConsumption = 0; 
          } else {
             myConsumption = (txn.amount / 100);
          }
      }

      // Update Net Balance
      runningBalance += (amountIPaid - myConsumption);
      balanceLabels.push(dateStr);
      balancePoints.push(runningBalance);

      // Track Active Days
      if (amountIPaid > 0 || myConsumption > 0) {
          activeDays.add(date.toDateString());
      }

      // --- Heatmap Logic ---
      if (monthKey === currentMonthKey && day >= 1 && day <= 31) {
          let flow = 0;
          if (txn.type === 'income') {
              flow -= (txn.amount / 100);
          } else {
              if (txn.payer === 'me') {
                  flow += (txn.amount / 100);
              }
              if (txn.isReturn && txn.participants.includes('me') && txn.payer !== 'me') {
                  flow -= (txn.amount / 100);
              }
          }
          heatmapData[day] += flow;
      }

      // --- Detailed Stats ---
      if (txn.type !== 'income') {
          if (txn.isReturn) {
              if (txn.payer === 'me') {
                  totalRepaymentSent += (txn.amount / 100);
              } else if (txn.participants.includes('me') || txn.payer !== 'me') {
                  // Assume if I'm involved and didn't pay, I received it
                  // Note: recipient is in participants[0]
                  if (txn.participants.includes('me')) {
                      totalReceived += (txn.amount / 100);
                      monthlyReceivedStats[monthKey] = (monthlyReceivedStats[monthKey] || 0) + (txn.amount / 100);
                  }
              }
          } else {
              // 1. Lending
              if (txn.payer === 'me') {
                  const lent = amountIPaid - myConsumption;
                  if (lent > 0.01) {
                      totalLent += lent;
                      monthlyLentStats[monthKey] = (monthlyLentStats[monthKey] || 0) + lent;
                      if (monthKey === currentMonthKey) currentMonthLent += lent;
                  }
              }

              // 2. Spending
              if (Math.abs(myConsumption) > 0.001) {
                  totalSpend += myConsumption;
                  monthlySpendStats[monthKey] = (monthlySpendStats[monthKey] || 0) + myConsumption;
                  
                  const place = txn.place || 'Unknown';
                  placeStats[place] = (placeStats[place] || 0) + myConsumption;
                  
                  const cat = txn.category || 'Uncategorized';
                  categoryStats[cat] = (categoryStats[cat] || 0) + myConsumption;

                  if (monthKey === currentMonthKey) {
                      currentMonthSpend += myConsumption;
                      currentMonthCatStats[cat] = (currentMonthCatStats[cat] || 0) + myConsumption;
                  }
              }

              // 3. Participants
              if (txn.splits) {
                  Object.entries(txn.splits).forEach(([uid, sharePaise]) => {
                      const name = uid === 'me' ? 'You' : (participantsLookup.get(uid)?.name || uid);
                      participantShareStats[name] = (participantShareStats[name] || 0) + (sharePaise / 100);
                  });
              }
          }
      }
    });

    // 3. Aggregation
    const allMonthKeys = new Set([...Object.keys(monthlySpendStats), ...Object.keys(monthlyLentStats)]);
    const monthlyKeys = Array.from(allMonthKeys).sort();
    
    let peakMonth = '-'; 
    let peakAmount = 0;
    monthlyKeys.forEach(k => {
      const val = monthlySpendStats[k] || 0;
      if (val > peakAmount) { peakAmount = val; peakMonth = k; }
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

    // Forecasts
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const projectedSpend = (currentMonthSpend / daysPassed) * daysInMonth;
    const forecastSpendPercent = projectedSpend > 0 ? Math.min(100, (currentMonthSpend / projectedSpend) * 100) : 0;
    
    const projectedLending = (currentMonthLent / daysPassed) * daysInMonth;
    const forecastLentPercent = projectedLending > 0 ? Math.min(100, (currentMonthLent / projectedLending) * 100) : 0;

    const sortedCats = Object.entries(categoryStats).sort((a,b) => b[1] - a[1]);
    const sortedPlaces = Object.entries(placeStats).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const sortedCurrentCats = Object.entries(currentMonthCatStats).sort((a,b) => b[1] - a[1]);

    // --- UPDATED METRIC CALCULATION ---
    // Cash Flow = Money Out (Spend + Lent) - Money In (Repaid/Received)
    const customCashFlow = (totalSpend + totalLent) - totalReceived;

    return {
      totalSpend, totalLent, totalRepaymentSent, totalReceived, totalIncome,
      customCashFlow, 
      activeDays: activeDays.size,
      peakMonth, peakAmount, avgMonthly,
      currentMonthSpend, currentMonthLent,
      projectedSpend, forecastSpendPercent,
      projectedLending, forecastLentPercent,
      
      heatmapData,
      monthlyChart: { 
          labels: monthlyChartLabels, 
          spendData: monthlyKeys.map(k => monthlySpendStats[k] || 0),
          lentData: monthlyKeys.map(k => monthlyLentStats[k] || 0),
          receivedData: monthlyKeys.map(k => monthlyReceivedStats[k] || 0)
      },
      netBalanceChart: { labels: balanceLabels, data: balancePoints },
      categoryData: sortedCats.map(([k, v]) => ({ label: k, value: v })),
      currentMonthBreakdown: sortedCurrentCats,
      participantData: participantShareStats,
      placeData: { 
          labels: sortedPlaces.map(i => i[0]), 
          datasets: [{
              label: 'My Spend',
              data: sortedPlaces.map(i => i[1]),
              backgroundColor: '#6366f1',
              borderRadius: 4
          }]
      }
    };
  }, [transactions, participantsLookup]);

  if (loading) return <div>Loading analytics...</div>;

  const commonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: textColor, boxWidth: 12, font: { size: 11 } } } }
  };

  const barOptions = {
      ...commonOptions,
      plugins: { legend: { display: false } },
      scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
  };
  
  const lendingBarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: textColor } } },
      scales: {
          x: { ticks: { color: textColor }, grid: { display: false } },
          y: { ticks: { color: textColor }, grid: { color: gridColor } }
      }
  };

  const chartColors = ['#0ea5e9', '#f97316', '#10b981', '#6366f1', '#ec4899', '#f59e0b', '#ef4444'];

  const lendingBarData = {
      labels: stats.monthlyChart.labels,
      datasets: [
          { label: 'Lent (Out)', data: stats.monthlyChart.lentData, backgroundColor: '#f59e0b', borderRadius: 4 },
          { label: 'Received (In)', data: stats.monthlyChart.receivedData, backgroundColor: '#10b981', borderRadius: 4 }
      ]
  };

  const breakdownData = {
      labels: ['My Expenses', 'Money Lent', 'Repayments I Made'],
      datasets: [{
          data: [stats.totalSpend, stats.totalLent, stats.totalRepaymentSent],
          backgroundColor: ['#f43f5e', '#f59e0b', '#3b82f6'], 
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2
      }]
  };

  const participantPieData = {
      labels: Object.keys(stats.participantData),
      datasets: [{
          data: Object.values(stats.participantData),
          backgroundColor: chartColors,
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2
      }]
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Analytics Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Consumption (Expense)" value={formatCurrency(stats.totalSpend * 100)} />
        <StatCard title="Total Lent (Asset)" value={formatCurrency(stats.totalLent * 100)} color="text-amber-600" />
        
        {/* FIXED: Now shows Money Received */}
        <StatCard title="Total Repaid (Received)" value={formatCurrency(stats.totalReceived * 100)} color="text-green-600" />
        
        {/* FIXED: Spend + Lent - Received */}
        <StatCard 
            title="Net Cash Flow" 
            value={formatCurrency(stats.customCashFlow * 100)} 
            subValue="Spend + Lent - Received" 
            color="text-purple-600" 
        />
        
        <StatCard title="Highest Spend Month" value={stats.peakMonth} subValue={formatCurrency(stats.peakAmount * 100)} />
        <StatCard title="Avg. Monthly Spend" value={formatCurrency(stats.avgMonthly * 100)} />
        <StatCard title="Active Days" value={stats.activeDays} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Monthly Cash Flow (Spend + Lent)">
          <MonthlyTrendLine 
            labels={stats.monthlyChart.labels} 
            spendData={stats.monthlyChart.spendData} 
            lentData={stats.monthlyChart.lentData} 
          />
        </ChartCard>
        <ChartCard title="Lending vs Recovery (Monthly)">
           <Bar data={lendingBarData} options={lendingBarOptions} />
        </ChartCard>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Net Balance History</h3>
          <div className="h-64 relative">
            <NetBalanceLine labels={stats.netBalanceChart.labels} data={stats.netBalanceChart.data} />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="space-y-6">
             <ForecastCard 
                title="Spending Forecast"
                spent={stats.currentMonthSpend} 
                projected={stats.projectedSpend} 
                percent={stats.forecastSpendPercent} 
                colorClass="bg-sky-500"
             />
             <ForecastCard 
                title="Lending Forecast"
                spent={stats.currentMonthLent} 
                projected={stats.projectedLending} 
                percent={stats.forecastLentPercent} 
                colorClass="bg-amber-500"
                textColor="text-amber-600 dark:text-amber-400"
             />
         </div>
         <HeatmapPanel data={stats.heatmapData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Outflow Breakdown">
            <Doughnut data={breakdownData} options={commonOptions} />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <ChartCard title="Spending by Participant">
             <Pie data={participantPieData} options={commonOptions} />
         </ChartCard>
         
         <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
             <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Spending by Place</h3>
             <div className="h-64 relative">
                 <Bar data={stats.placeData} options={barOptions} />
             </div>
         </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Where Did My Month Go? (Spending)</h3>
            <div className="space-y-3 max-h-60 overflow-y-auto no-scrollbar">
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
    </div>
  );
};

const StatCard = ({ title, value, subValue, color }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>
    <div className={`text-2xl font-bold mt-2 ${color || 'text-gray-800 dark:text-gray-200'}`}>{value}</div>
    {subValue && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subValue}</div>}
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

const ForecastCard = ({ title, spent, projected, percent, label, colorClass, lightClass, textColor }) => {
    const finalTextColor = textColor || 'text-sky-600 dark:text-sky-400';
    const finalLightClass = lightClass || 'bg-gray-100 dark:bg-gray-700';
    const finalLabel = label || 'Current';

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{title} (Current Month)</h3>
            <div className="relative pt-4">
                <div className="flex mb-2 items-center justify-between">
                    <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${finalTextColor} ${finalLightClass}`}>
                        {finalLabel} {formatCurrency(spent * 100)}
                    </span>
                    <span className={`text-xs font-semibold inline-block ${finalTextColor}`}>
                        {Math.round(percent)}% of projection
                    </span>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                    <div style={{ width: `${percent}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${colorClass} transition-all duration-500`}></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Projected total: <span className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(projected * 100)}</span>
                </p>
            </div>
        </div>
    );
};

const HeatmapPanel = ({ data }) => {
  const maxVal = Math.max(...data.map(Math.abs));
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 overflow-hidden">
        <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Net Cash Flow Heatmap</h3>
        <div className="flex gap-4 mb-3 text-xs">
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Money Out</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> Money In</span>
        </div>
        
        <div className="grid gap-1 overflow-x-auto pb-2" style={{ gridTemplateColumns: 'repeat(31, 1fr)' }}>
            {[...Array(31)].map((_, i) => (<div key={i} className="text-[9px] text-center text-gray-400">{i+1}</div>))}
            {[...Array(31)].map((_, i) => {
                const val = data[i+1];
                let bgClass = 'bg-gray-100 dark:bg-gray-700';
                let opacity = 1;
                if (val > 0.01) {
                    bgClass = 'bg-red-500';
                    opacity = Math.max(0.2, val / (maxVal || 1));
                } else if (val < -0.01) {
                    bgClass = 'bg-emerald-500';
                    opacity = Math.max(0.2, Math.abs(val) / (maxVal || 1));
                }
                return (
                    <div 
                        key={i} 
                        title={`Day ${i+1}: ${val > 0 ? '-' : '+'}${formatCurrency(Math.abs(val)*100)}`} 
                        className={`h-8 w-full rounded-sm ${bgClass}`} 
                        style={{ opacity: val !== 0 ? opacity : 1 }} 
                    />
                );
            })}
        </div>
    </div>
  );
};

export default Analytics;