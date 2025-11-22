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

  const chartData = {
    labels,
    datasets: [
      {
        label: 'My Expense',
        data: spendData,
        fill: true,
        borderColor: '#0ea5e9', // sky-500
        backgroundColor: 'rgba(14, 165, 233, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Lent to Others',
        data: lentData,
        fill: true,
        borderColor: '#f59e0b', // amber-500
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
          display: true,
          labels: { color: textColor, boxWidth: 12 }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
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
        stacked: true,
        ticks: { color: textColor },
        grid: { color: gridColor },
        beginAtZero: true,
      },
    },
  };

  return <Line data={chartData} options={options} />;
};

export default MonthlyTrendLine;