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

      // Use ONLY user's share (splits.me), not full amount
      const myShare = txn.splits?.me || 0;
      const val = myShare / 100; // Convert paise to rupees

      if (val > 0) {
        if (!tagStats[tag]) {
          tagStats[tag] = {
            count: 0,
            total: 0,
            firstDate: null,
            lastDate: null
          };
        }

        tagStats[tag].count++;
        tagStats[tag].total += val;

        // Track first and last transaction dates for avg/day calculation
        const txnDate = txn.timestamp?.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
        if (!isNaN(txnDate.getTime())) {
          if (!tagStats[tag].firstDate || txnDate < tagStats[tag].firstDate) {
            tagStats[tag].firstDate = txnDate;
          }
          if (!tagStats[tag].lastDate || txnDate > tagStats[tag].lastDate) {
            tagStats[tag].lastDate = txnDate;
          }
        }
      }
    });

    const sortedTags = Object.entries(tagStats)
      .map(([name, data]) => {
        // Calculate days span (at least 1 day to avoid division by zero)
        let days = 1;
        if (data.firstDate && data.lastDate) {
          const diffTime = Math.abs(data.lastDate - data.firstDate);
          days = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
        }
        return {
          name,
          count: data.count,
          total: data.total,
          avgPerDay: data.total / days,
          days
        };
      })
      .sort((a, b) => b.total - a.total);

    const top10 = sortedTags.slice(0, 10);
    return {
      tableData: sortedTags,
      chartLabels: top10.map(t => t.name),
      chartValues: top10.map(t => t.total)
    };
  }, [transactions]);

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      <div className="glass-card p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-violet-400 to-purple-400">Tags Analysis</h2>
        <p className="text-gray-400 mt-1">Track your personal share of spending by tags</p>
      </div>

      {/* Responsive Grid: Stack on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Table Section - Wrapped in Overflow */}
        <div className="lg:col-span-2 glass-card flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/5">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tag</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Count</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">My Share</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg/Txn</th>
                  <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Avg/Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stats.tableData.map(t => (
                  <tr key={t.name} className="hover:bg-white/5">
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">{t.name}</td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-400">{t.count}</td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-200">{formatCurrency(t.total * 100)}</td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-400">{formatCurrency((t.total / (t.count || 1)) * 100)}</td>
                    <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-purple-400">{formatCurrency(t.avgPerDay * 100)}</td>
                  </tr>
                ))}
                {stats.tableData.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-6 py-4 text-center text-gray-500">No tagged expenses found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart Section */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-gray-300 mb-4">Top Tags by My Share</h3>
          <div className="relative h-64">
            <TagsBarChart labels={stats.chartLabels} data={stats.chartValues} />
          </div>
        </div>

      </div>
    </div>
  );
};

export default TagsAnalysis;