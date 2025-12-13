import { useRef, useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { useTheme } from '../../hooks/useTheme';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MonthlyTrendLine = ({ labels, spendData, lentData }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#d1d5db' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const chartRef = useRef(null);
  const [chartData, setChartData] = useState({ datasets: [] });

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const ctx = chart.ctx;

    // Create Gradients
    const gradientSky = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSky.addColorStop(0, 'rgba(14, 165, 233, 0.5)');
    gradientSky.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

    const gradientAmber = ctx.createLinearGradient(0, 0, 0, 400);
    gradientAmber.addColorStop(0, 'rgba(245, 158, 11, 0.5)');
    gradientAmber.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

    setChartData({
      labels,
      datasets: [
        {
          label: 'My Expense',
          data: spendData,
          fill: true,
          borderColor: '#0ea5e9', // sky-500
          backgroundColor: gradientSky,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#0ea5e9',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
        },
        {
          label: 'Lent to Others',
          data: lentData,
          fill: true,
          borderColor: '#f59e0b', // amber-500
          backgroundColor: gradientAmber,
          pointBackgroundColor: '#fff',
          pointBorderColor: '#f59e0b',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.3,
        },
      ],
    });
  }, [labels, spendData, lentData]); // Re-run when data changes

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { color: textColor, boxWidth: 12, usePointStyle: true }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: isDark ? 'rgba(17, 24, 39, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        titleColor: isDark ? '#fff' : '#111',
        bodyColor: isDark ? '#ccc' : '#444',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ₹${Number(ctx.raw).toFixed(2)}`
        }
      },
    },
    scales: {
      x: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
      y: {
        // stacked: true, // Often better unstacked for trend comparison
        ticks: { color: textColor },
        grid: { color: gridColor },
        beginAtZero: true,
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return <Line ref={chartRef} data={chartData} options={options} />;
};

export default MonthlyTrendLine;