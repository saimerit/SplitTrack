import { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, 
  LinearScale, BarElement, Title, PointElement, LineElement, Filler
} from 'chart.js';
import { Doughnut, Pie, Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Download } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import MonthlyTrendLine from '../components/charts/MonthlyTrendLine';
import NetBalanceLine from '../components/charts/NetBalanceLine';
import CategoryDoughnut from '../components/charts/CategoryDoughnut'; 
import { useTheme } from '../hooks/useTheme';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader'; 

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, Filler);

const Analytics = () => {
  const { transactions, participantsLookup } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#d1d5db' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const [stats, setStats] = useState(null);
  const [isCalculating, setIsCalculating] = useState(true);
  const workerRef = useRef(null);

  useEffect(() => {
        workerRef.current = new Worker(new URL('../workers/analytics.worker.js', import.meta.url), { type: 'module' });
        workerRef.current.onmessage = (event) => {
            setStats(event.data);
            setIsCalculating(false);
        };
        return () => { workerRef.current?.terminate(); };
    }, []);

    useEffect(() => {
    if (!workerRef.current) return;
    setTimeout(() => setIsCalculating(true), 0);

    const serializedTransactions = transactions
        .filter(t => !t.isDeleted)
        .map(t => ({
        ...t,
        timestamp: t.timestamp?.toMillis ? t.timestamp.toMillis() : new Date(t.timestamp).getTime()
        }));
    const serializedLookup = Array.from(participantsLookup.entries());

    workerRef.current.postMessage({ transactions: serializedTransactions, participantsLookup: serializedLookup });
    }, [transactions, participantsLookup]);

  if (isCalculating || !stats) return <Loader />;

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("SplitTrack Monthly Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toDateString()}`, 14, 30);
    doc.autoTable({
      startY: 40,
      head: [['Metric', 'Value']],
      body: [
        ['Total Spent', formatCurrency(stats.totalSpend * 100)],
        ['Total Lent', formatCurrency(stats.totalLent * 100)],
        ['Net Cash Flow', formatCurrency(stats.customCashFlow * 100)],
        ['Highest Spend Month', `${stats.peakSpendMonth} (${formatCurrency(stats.peakSpendAmount*100)})`]
      ],
    });
    doc.save(`SplitTrack_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

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
  const lendingBarData = {
      labels: stats.monthlyChart.labels,
      datasets: [
          { label: 'Lent', data: stats.monthlyChart.lentData, backgroundColor: '#f59e0b', borderRadius: 4 },
          { label: 'Received', data: stats.monthlyChart.receivedData, backgroundColor: '#10b981', borderRadius: 4 }
      ]
  };
  const breakdownData = {
      labels: ['My Expenses', 'Money Lent', 'Repayments Made'],
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
          backgroundColor: ['#0ea5e9', '#f97316', '#10b981', '#6366f1', '#ec4899', '#f59e0b', '#ef4444'],
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2
      }]
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">Analytics</h2>
        <Button onClick={generatePDF} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Download size={18} /> PDF Report
        </Button>
      </div>
      
      {/* Responsive Grid: 1 col mobile, 2 col tablet, 4 col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Consumption" value={formatCurrency(stats.totalSpend * 100)} />
        <StatCard title="Total Lent" value={formatCurrency(stats.totalLent * 100)} color="text-amber-600" />
        <StatCard title="Total Repaid" value={formatCurrency(stats.totalReceived * 100)} color="text-green-600" />
        <StatCard title="Net Cash Flow" value={formatCurrency(stats.customCashFlow * 100)} subValue="Spend + Lent - Received" color="text-purple-600" />
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Peak Monthly Spend" value={stats.peakSpendMonth} subValue={formatCurrency(stats.peakSpendAmount * 100)} />
        <StatCard title="Peak Outflow" value={stats.peakOutflowMonth} subValue={formatCurrency(stats.peakOutflowAmount * 100)} />
        <StatCard title="Avg. Monthly Outflow" value={formatCurrency(stats.avgMonthly * 100)} />
        <StatCard title="Active Days" value={stats.activeDays} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Monthly Cash Flow">
          <MonthlyTrendLine labels={stats.monthlyChart.labels} spendData={stats.monthlyChart.spendData} lentData={stats.monthlyChart.lentData} />
        </ChartCard>
        <ChartCard title="Lending vs Recovery">
           <Bar data={lendingBarData} options={lendingBarOptions} />
        </ChartCard>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Net Balance History</h3>
          <div className="h-56 md:h-64 relative">
            <NetBalanceLine labels={stats.netBalanceChart.labels} data={stats.netBalanceChart.data} />
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="space-y-6">
             <ForecastCard title="Spending Forecast" spent={stats.currentMonthSpend} projected={stats.projectedSpend} percent={stats.forecastSpendPercent} colorClass="bg-sky-500"/>
             <ForecastCard title="Lending Forecast" spent={stats.currentMonthLent} projected={stats.projectedLending} percent={stats.forecastLentPercent} colorClass="bg-amber-500" textColor="text-amber-600 dark:text-amber-400"/>
         </div>
         <HeatmapPanel data={stats.heatmapData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Outflow Breakdown">
            <Doughnut data={breakdownData} options={commonOptions} />
        </ChartCard>
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">My Spending by Category</h3>
            <div className="h-64 md:h-64 relative">
                {stats.categoryData.length > 0 ? <CategoryDoughnut data={stats.categoryData} /> : <div className="flex items-center justify-center h-full text-gray-400">No data</div>}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <ChartCard title="Spending by Participant">
             <Pie data={participantPieData} options={commonOptions} />
         </ChartCard>
         <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
             <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Spending by Place</h3>
             <div className="h-64 md:h-64 relative">
                 <Bar data={stats.placeData} options={barOptions} />
             </div>
         </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, subValue, color }) => (
  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">{title}</h3>
    <div className={`text-xl sm:text-2xl font-bold mt-2 ${color || 'text-gray-800 dark:text-gray-200'}`}>{value}</div>
    {subValue && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{subValue}</div>}
  </div>
);

const ChartCard = ({ title, children }) => (
  <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
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
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">{title} <span className="text-sm font-normal text-gray-500">(Current Month)</span></h3>
            <div className="relative pt-4">
                <div className="flex mb-2 items-center justify-between">
                    <span className={`text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full ${finalTextColor} ${finalLightClass}`}>
                        {finalLabel} {formatCurrency(spent * 100)}
                    </span>
                    <span className={`text-xs font-semibold inline-block ${finalTextColor}`}>
                        {Math.round(percent)}%
                    </span>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                    <div style={{ width: `${Math.min(percent, 100)}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${colorClass} transition-all duration-500`}></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    Projected: <span className="font-bold text-gray-700 dark:text-gray-200">{formatCurrency(projected * 100)}</span>
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
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-sm"></div> Out</span>
            <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div> In</span>
        </div>
        
        {/* Responsive Grid for Heatmap: Scrollable on mobile */}
        <div className="overflow-x-auto">
            <div className="grid gap-1 min-w-[300px]" style={{ gridTemplateColumns: 'repeat(31, 1fr)' }}>
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
    </div>
  );
};

export default Analytics;