import { useEffect, useState, useRef } from 'react';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, Title, PointElement, LineElement, Filler
} from 'chart.js';
import { Doughnut, Pie, Bar } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Download, TrendingUp, Calendar, PieChart, Layers } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import MonthlyTrendLine from '../components/charts/MonthlyTrendLine';
import NetBalanceLine from '../components/charts/NetBalanceLine';
import CategoryDoughnut from '../components/charts/CategoryDoughnut';
import { useTheme } from '../hooks/useTheme';
import Button from '../components/common/Button';
import Loader from '../components/common/Loader';
import StatCard from '../components/common/StatCard';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title, PointElement, LineElement, Filler);

const Analytics = () => {
  const { transactions, participantsLookup, categories } = useAppStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#9ca3af' : '#4b5563';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

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
    setIsCalculating(true);
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

  // --- PDF GENERATION ---
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("Financial Report", 14, 22);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 28);

    doc.autoTable({
      startY: 40,
      headStyles: { fillColor: [14, 165, 233] },
      head: [['Metric', 'Value']],
      body: [
        ['Total Consumption', formatCurrency(stats.totalSpend * 100)],
        ['Total Lent', formatCurrency(stats.totalLent * 100)],
        ['Net Position', formatCurrency(stats.customCashFlow * 100)],
        ['Highest Spend Month', `${stats.peakSpendMonth} (${formatCurrency(stats.peakSpendAmount * 100)})`]
      ],
    });
    doc.save(`SplitTrack_Analytics_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // --- CHART OPTIONS ---
  const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: textColor, padding: 20, usePointStyle: true } },
      tooltip: {
        backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDark ? '#fff' : '#111',
        bodyColor: isDark ? '#ccc' : '#444',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8
      }
    },
    layout: { padding: 10 }
  };

  const chartCardClass = "glass-panel p-6 rounded-2xl transition-all hover:shadow-md";

  // --- RENDER HELPERS ---
  return (
    <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto">

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-gray-200/50 dark:border-gray-700/50 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-3">
            <div className="p-2 bg-sky-100 dark:bg-sky-900/30 rounded-lg text-sky-600 dark:text-sky-400">
              <TrendingUp size={28} />
            </div>
            Financial Analytics
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-xl">
            Deep dive into your spending habits, cash flow trends, and category breakdowns.
          </p>
        </div>
        <Button onClick={generatePDF} className="shadow-lg shadow-indigo-500/20">
          <Download size={18} className="mr-2" /> Download Report
        </Button>
      </div>

      {/* KPI GRID */}
      <section>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">Key Performance Indicators</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard title="Total Consumption" value={stats.totalSpend * 100} colorTheme="blue" />
          <StatCard title="Total Received" value={stats.totalReceived * 100} colorTheme="emerald" />
          <StatCard title="Net Cash Flow" value={stats.customCashFlow * 100} subValue="Spend + Lent - Received" colorTheme="dynamic" />
          <StatCard title="Total Lent" value={stats.totalLent * 100} colorTheme="orange" />
          <StatCard title="Active Days" value={stats.activeDays} colorTheme="gray" formatter={(v) => v} />
        </div>
      </section>

      {/* DETAILED OUTFLOW ANALYSIS */}
      <section>
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">Analysis Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Peak Monthly Spend"
            value={stats.peakSpendAmount * 100}
            subtitle={stats.peakSpendMonth}
            colorTheme="rose"
          />
          <StatCard
            title="Peak Total Outflow"
            value={stats.peakOutflowAmount * 100}
            subtitle={stats.peakOutflowMonth}
            colorTheme="purple"
          />
          <StatCard
            title="Avg. Monthly Outflow"
            value={stats.avgMonthly * 100}
            subtitle="Spend + Lent"
            colorTheme="blue"
          />
        </div>
      </section>

      {/* MAIN TRENDS ROW */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Net Balance (Wide) */}
        <div className={`xl:col-span-2 ${chartCardClass}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Layers size={18} className="text-sky-500" /> Net Balance History
            </h3>
          </div>
          <div className="h-72 w-full">
            <NetBalanceLine labels={stats.netBalanceChart.labels} data={stats.netBalanceChart.data} />
          </div>
        </div>

        {/* Monthly Heatmap */}
        <div className={`xl:col-span-1 ${chartCardClass} flex flex-col`}>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <Calendar size={18} className="text-purple-500" /> Daily Activity
          </h3>
          <div className="flex-1 flex flex-col justify-center">
            <HeatmapPanel data={stats.heatmapData} />
          </div>
        </div>
      </div>

      {/* CATEGORY & BREAKDOWN ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className={chartCardClass}>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-6 flex items-center gap-2">
            <PieChart size={18} className="text-rose-500" /> Spending by Category
          </h3>
          <div className="h-64 relative">
            {stats.categoryData.length > 0 ? (
              <CategoryDoughnut data={stats.categoryData} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
            )}
          </div>
        </div>

        <div className={chartCardClass}>
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-6">Forecast vs Reality</h3>
          <div className="space-y-8 mt-4">
            <ForecastBar
              title="Spending"
              current={stats.currentMonthSpend}
              projected={stats.projectedSpend}
              percent={stats.forecastSpendPercent}
              color="bg-rose-500"
            />
            <ForecastBar
              title="Lending"
              current={stats.currentMonthLent}
              projected={stats.projectedLending}
              percent={stats.forecastLentPercent}
              color="bg-amber-500"
            />
          </div>
        </div>
      </div>

      {/* MONTHLY TRENDS */}
      <div className={chartCardClass}>
        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-6">Cash Flow Trends</h3>
        <div className="h-80">
          <MonthlyTrendLine
            labels={stats.monthlyChart.labels}
            spendData={stats.monthlyChart.spendData}
            lentData={stats.monthlyChart.lentData}
          />
        </div>
      </div>

    </div>
  );
};

// --- SUB-COMPONENTS ---

const ForecastBar = ({ title, current, projected, percent, color }) => (
  <div>
    <div className="flex justify-between text-sm mb-2">
      <span className="font-semibold text-gray-600 dark:text-gray-300">{title}</span>
      <span className="text-gray-500 dark:text-gray-400">
        <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(current * 100)}</span> / {formatCurrency(projected * 100)}
      </span>
    </div>
    <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`}
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
    </div>
    <div className="text-right text-xs text-gray-400 mt-1">{Math.round(percent)}% of projection</div>
  </div>
);

const HeatmapPanel = ({ data }) => {
  const maxVal = Math.max(...data.map(Math.abs)) || 1;
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const val = data[day] || 0;
          let bgColor = 'bg-gray-100 dark:bg-gray-700'; // Default empty
          let opacity = 1;

          if (val > 0) { // Expense/Out
            // Scale redness opacity based on value relative to max
            opacity = 0.3 + (0.7 * (Math.abs(val) / maxVal));
            bgColor = `bg-rose-500`;
          } else if (val < 0) { // Income/In
            opacity = 0.3 + (0.7 * (Math.abs(val) / maxVal));
            bgColor = `bg-emerald-500`;
          }

          return (
            <div
              key={day}
              className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-all hover:scale-110 cursor-default ${bgColor} ${val !== 0 ? 'text-white shadow-sm' : 'text-gray-300 dark:text-gray-600'}`}
              style={{ opacity: val !== 0 ? opacity : 1 }}
              title={`Day ${day}: ${formatCurrency(Math.abs(val) * 100)}`}
            >
              {day}
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-4 text-xs text-gray-400">
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> In</div>
        <div className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-full"></div> Out</div>
      </div>
    </div>
  );
};

export default Analytics;