import { useMemo } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import TagsBarChart from '../components/charts/TagsBarChart';

const TagsAnalysis = () => {
  const { transactions } = useAppStore();

  const stats = useMemo(() => {
    const tagStats = {}; 
    transactions.forEach(txn => {
      if (txn.isReturn) return;
      const tag = txn.tag || 'No Tag';
      const val = (txn.splits?.me || txn.amount || 0) / 100;
      if (!tagStats[tag]) tagStats[tag] = { count: 0, total: 0 };
      if (val > 0) {
        tagStats[tag].count++;
        tagStats[tag].total += val;
      }
    });

    const sortedTags = Object.entries(tagStats)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);

    const top10 = sortedTags.slice(0, 10);
    return {
      tableData: sortedTags,
      chartLabels: top10.map(t => t.name),
      chartValues: top10.map(t => t.total)
    };
  }, [transactions]);

  return (
    <div className="space-y-6 pb-20">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">Tags Analysis</h2>

      {/* Responsive Grid: Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Table Section - Wrapped in Overflow */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 flex flex-col">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tag</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Count</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total Spent</th>
                  <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Avg/Txn</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {stats.tableData.map(t => (
                  <tr key={t.name} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{t.count}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">{formatCurrency(t.total * 100)}</td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{formatCurrency((t.total / (t.count || 1)) * 100)}</td>
                  </tr>
                ))}
                {stats.tableData.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-4 text-center text-gray-500">No tagged expenses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Top Tags by Spend</h3>
            <div className="relative h-64">
                <TagsBarChart labels={stats.chartLabels} data={stats.chartValues} />
            </div>
        </div>

      </div>
    </div>
  );
};

export default TagsAnalysis;