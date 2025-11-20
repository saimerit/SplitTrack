import { Line } from 'react-chartjs-2';
import { useTheme } from '../../hooks/useTheme';

const NetBalanceLine = ({ labels, data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? '#d1d5db' : '#374151';
  const gridColor = isDark ? '#374151' : '#e5e7eb';

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Cumulative Net Balance',
        data,
        fill: true,
        borderColor: '#8b5cf6', // violet-500
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        pointRadius: 0, // clean look like original
        hitRadius: 10,
        tension: 0.1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
            label: (ctx) => ` ₹${ctx.raw.toFixed(2)}`
        }
      }
    },
    scales: {
      x: { display: false }, // Hide X labels for cleaner look on cumulative charts
      y: {
        ticks: { color: textColor },
        grid: { color: gridColor },
      },
    },
  };

  return <Line data={chartData} options={options} />;
};

export default NetBalanceLine;