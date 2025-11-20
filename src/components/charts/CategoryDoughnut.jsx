import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { useTheme } from '../../hooks/useTheme';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const CategoryDoughnut = ({ data }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const chartData = {
    labels: data.map(d => d.label),
    datasets: [{
      data: data.map(d => d.value),
      backgroundColor: [
        '#0ea5e9', // sky-500
        '#f97316', // orange-500
        '#10b981', // emerald-500
        '#6366f1', // indigo-500
        '#ec4899', // pink-500
        '#f59e0b', // amber-500
      ],
      borderColor: isDark ? '#1f2937' : '#ffffff',
      borderWidth: 2,
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: isDark ? '#d1d5db' : '#374151',
          boxWidth: 12,
          font: { size: 11 }
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
             const val = context.raw;
             return ` ₹${val.toFixed(2)}`;
          }
        }
      }
    }
  };

  return <Doughnut data={chartData} options={options} />;
};

// THIS LINE IS CRITICAL
export default CategoryDoughnut;