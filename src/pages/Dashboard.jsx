import { useMemo, useState, useEffect } from 'react';
import { useBalances } from '../hooks/useBalances';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import CategoryDoughnut from '../components/charts/CategoryDoughnut';
import CreditDebtRatio from '../components/charts/CreditDebtRatio';
import Button from '../components/common/Button';
import StatCard from '../components/common/StatCard';
import EmptyStateChart from '../components/common/EmptyStateChart';
import UserAvatar from '../components/common/UserAvatar';
import { DashboardSkeleton } from '../components/common/Skeleton';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/modals/ConfirmModal';
import { checkDueRecurring, processRecurringTransaction, skipRecurringTransaction, addTransaction, rectifyAllStats } from '../services/transactionService';
import { Timestamp } from 'firebase/firestore';
import { RefreshCcw, Users, LayoutGrid, Calendar, Sun, Sunset, Moon } from 'lucide-react';
// NEW: Smart components
import BriefingCard from '../components/common/BriefingCard';
import SmartSettle from '../components/common/SmartSettle';
import PullToRefresh from '../components/common/PullToRefresh';

const Dashboard = () => {
  const navigate = useNavigate();
  const { transactions, participants, loading, templates, showToast } = useAppStore();
  const [showSummary, setShowSummary] = useState(false);

  // Tab state for new tabbed interface
  const [activeTab, setActiveTab] = useState('summary');

  // --- NEW STATE: Rectify Stats ---
  const [isRectifying, setIsRectifying] = useState(false);

  // --- NEW STATE: Recurring Logic ---
  const [dueRecurringItem, setDueRecurringItem] = useState(null);
  const [showRecurModal, setShowRecurModal] = useState(false);

  // --- FEATURE 1: Check Recurring on Load ---
  useEffect(() => {
    const checkForRecurring = async () => {
      if (loading) return;
      try {
        const dueItems = await checkDueRecurring();
        if (dueItems && dueItems.length > 0) {
          // Grab the first due item to process
          setDueRecurringItem(dueItems[0]);
          setShowRecurModal(true);
        }
      } catch (err) {
        console.error("Failed to check recurring", err);
      }
    };
    checkForRecurring();
  }, [loading]);

  const handleProcessRecurring = async () => {
    if (!dueRecurringItem) return;
    try {
      await processRecurringTransaction(dueRecurringItem.id, dueRecurringItem);
      showToast(`Auto-logged: ${dueRecurringItem.name}`, false);
      setShowRecurModal(false);
      setDueRecurringItem(null);
    } catch {
      showToast('Failed to log recurring item', true);
    }
  };

  const handleSkipRecurring = async () => {
    if (!dueRecurringItem) return;
    try {
      await skipRecurringTransaction(dueRecurringItem.id, dueRecurringItem.nextDueDate, dueRecurringItem.frequency);
      showToast(`Skipped: ${dueRecurringItem.name}`, false);
      setShowRecurModal(false);
      setDueRecurringItem(null);
    } catch {
      showToast('Error skipping item', true);
    }
  };

  // --- FEATURE 2: Quick Add Logic ---
  const pinnedTemplates = useMemo(() => {
    return templates ? templates.filter(t => t.isPinned) : [];
  }, [templates]);

  // Frequent templates based on usage (for personalization)
  const frequentTemplates = useMemo(() => {
    if (!templates) return [];
    // Get non-pinned templates sorted by usage count
    return templates
      .filter(t => !t.isPinned && (t.usageCount || 0) > 0)
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 3);
  }, [templates]);

  const handleQuickAdd = async (template) => {
    try {
      const txnData = {
        amount: template.amount,
        category: template.category,
        expenseName: template.expenseName || template.description, // Fix: Use expenseName
        payer: 'me', // Default to 'me' for quick add on personal dashboard
        splits: { 'me': template.amount },
        timestamp: Timestamp.now(), // Ensure current date
        type: 'expense',
        paymentMode: template.paymentMode || 'Cash', // Add paymentMode
        isDeleted: false,
        // Optional: Carry over other fields if present in template
        tag: template.tag || '',
        place: template.place || '',
        note: template.note || ''
      };
      await addTransaction(txnData);
      showToast(`Added ${template.expenseName || template.description}`, false);
      // useAppStore.getState().refreshViews(); // Not strictly needed if firestore listener updates, but good for safety
    } catch (e) {
      console.error(e);
      showToast('Failed to quick-add', true);
    }
  };

  // --- Core Balance Logic (useBalances for live data) ---
  const stats = useBalances(transactions, participants);

  // Calculate credit and debt for the ratio component
  const { totalCredit, totalDebt } = useMemo(() => {
    let credit = 0;
    let debt = 0;
    Object.values(stats.myPersonalBalances || {}).forEach(val => {
      if (val > 0) credit += val;
      else debt += Math.abs(val);
    });
    return { totalCredit: credit, totalDebt: debt };
  }, [stats.myPersonalBalances]);

  // --- Handle Rectify Stats ---
  const handleRectify = async () => {
    setIsRectifying(true);
    try {
      await rectifyAllStats(participants);
      showToast('Stats recalculated successfully!', false);
    } catch (err) {
      console.error('Rectify failed:', err);
      showToast('Failed to rectify stats', true);
    } finally {
      setIsRectifying(false);
    }
  };

  const handleSettleUp = (uid, amount) => {
    navigate('/add', {
      state: {
        type: 'expense',
        isReturn: true,
        payer: 'me',
        participants: [uid],
        amount: Math.abs(amount / 100),
        expenseName: 'Settlement'
      }
    });
  };

  // --- Who Owes Whom Logic ---
  const debtSummaryHtml = useMemo(() => {
    if (!stats) return "";
    const lines = Object.entries(stats.myPersonalBalances)
      .filter(([, val]) => Math.abs(val) > 1)
      .map(([uid, val]) => {
        const p = participants.find(x => x.uniqueId === uid);
        const name = p ? p.name : uid;

        if (val > 0) return `<li class="text-green-600">${name} owes you ${formatCurrency(val)}</li>`;
        return `<li class="text-red-600">You owe ${name} ${formatCurrency(Math.abs(val))}</li>`;
      });

    if (lines.length === 0) return "Everyone is settled up!";
    return `<ul class="space-y-2 list-disc list-inside">${lines.join('')}</ul>`;
  }, [stats, participants]);

  // Tab definitions
  const tabs = [
    { id: 'summary', label: 'Summary', icon: LayoutGrid },
    { id: 'people', label: 'People', icon: Users },
    { id: 'schedule', label: 'Schedule', icon: Calendar }
  ];

  // Time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', icon: Sun, class: 'greeting-morning' };
    if (hour < 18) return { text: 'Good afternoon', icon: Sunset, class: 'greeting-afternoon' };
    return { text: 'Good evening', icon: Moon, class: 'greeting-evening' };
  }, []);

  // Handle pull-to-refresh
  const handlePullRefresh = async () => {
    await handleRectify();
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <PullToRefresh onRefresh={handlePullRefresh}>
      <div className={`space-y-6 animate-fade-in mesh-gradient-dynamic ${stats.netPosition < 0 ? 'negative' : ''}`}>
        {/* Time-Based Greeting Header */}
        <div className="flex justify-between items-center mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <greeting.icon size={20} className="text-amber-400" />
              <span className={`text-sm font-medium ${greeting.class}`}>{greeting.text}!</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">Balances</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleRectify} disabled={isRectifying} className="haptic-tap">
              <RefreshCcw size={16} className={isRectifying ? 'animate-spin' : ''} />
              <span className="hidden sm:inline ml-1">Rectify</span>
            </Button>
            <Button variant="primary" onClick={() => setShowSummary(true)} className="haptic-tap">
              Who Owes Whom?
            </Button>
          </div>
        </div>

        {/* --- INSERT: Quick Add Shortcuts --- */}
        {(pinnedTemplates.length > 0 || frequentTemplates.length > 0) && (
          <div className="mb-6">
            {pinnedTemplates.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.15em] mb-3">Pinned</h3>
                <div className="flex flex-wrap gap-3 mb-4">
                  {pinnedTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleQuickAdd(t)}
                      className="flex items-center gap-2 px-4 py-2 border border-white/10 rounded-full shadow-sm hover:shadow-md hover:border-sky-500 transition-all text-sm font-medium text-gray-300 haptic-tap"
                      style={{ backgroundColor: 'var(--bg-surface)' }}
                    >
                      <span>⚡</span>
                      <span>{t.expenseName || t.description}</span>
                      <span className="text-xs text-gray-400 tabular-nums">({formatCurrency(t.amount)})</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {frequentTemplates.length > 0 && (
              <>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-[0.15em] mb-3">Frequent</h3>
                <div className="flex flex-wrap gap-3">
                  {frequentTemplates.map(t => (
                    <button
                      key={t.id}
                      onClick={() => handleQuickAdd(t)}
                      className="flex items-center gap-2 px-4 py-2 border border-white/5 rounded-full shadow-sm hover:shadow-md hover:border-amber-500/50 transition-all text-sm font-medium text-gray-400"
                      style={{ backgroundColor: 'var(--bg-surface)' }}
                    >
                      <span>🔥</span>
                      <span>{t.expenseName || t.description}</span>
                      <span className="text-xs text-gray-500">({formatCurrency(t.amount)})</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
                }`}
            >
              <tab.icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'summary' && (
          <>
            {/* StatCard Grid with Mesh Gradient Background */}
            <div className="mesh-gradient-bg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                  title="Your Net Position"
                  value={stats.netPosition}
                  subtitle={stats.netPosition > 0 ? "You are owed money" : "You owe money"}
                  colorTheme="dynamic"
                  className="lg:col-span-1"
                  delay={0}
                />

                <StatCard
                  title="Income (This Month)"
                  value={stats.monthlyIncome * 100}
                  colorTheme="emerald"
                  delay={100}
                />

                <StatCard
                  title="Total Expenditure"
                  value={stats.myTotalExpenditure}
                  subtitle="Total payments - Repayments"
                  colorTheme="blue"
                  delay={200}
                />

                <StatCard
                  title="My Total Share"
                  value={stats.myTotalShare}
                  colorTheme="purple"
                  delay={300}
                />

                <StatCard
                  title="Paid By Others"
                  value={stats.paidByOthers}
                  colorTheme="orange"
                  delay={400}
                />
              </div>
            </div>

            {/* Credit/Debt Ratio Bar */}
            <CreditDebtRatio credit={totalCredit} debt={totalDebt} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card p-6 md:col-span-1">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">My Share by Category</h3>
                <div className="h-48 md:h-64 relative">
                  {stats.chartData.length > 0 ? (
                    <CategoryDoughnut data={stats.chartData} />
                  ) : (
                    <EmptyStateChart title="No spending data" />
                  )}
                </div>
              </div>

              <div className="glass-card p-6 md:col-span-2">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Quick Summary</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
                  {Object.entries(stats.myPersonalBalances).filter(([, val]) => Math.abs(val) > 1).length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">You are all settled up!</p>
                  ) : (
                    Object.entries(stats.myPersonalBalances).slice(0, 3).map(([uid, val]) => {
                      if (Math.abs(val) < 1) return null;
                      const p = participants.find(x => x.uniqueId === uid);
                      const name = p ? p.name : uid;

                      return (
                        <div key={uid} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                          <UserAvatar name={name} uniqueId={uid} size="md" />
                          <span className="font-medium text-gray-700 dark:text-gray-300 flex-1">{name}</span>
                          <span className={`font-semibold ${val > 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {val > 0 ? `+${formatCurrency(val)}` : formatCurrency(val)}
                          </span>
                        </div>
                      );
                    })
                  )}
                  {Object.entries(stats.myPersonalBalances).filter(([, val]) => Math.abs(val) > 1).length > 3 && (
                    <button
                      onClick={() => setActiveTab('people')}
                      className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
                    >
                      View all →
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* AI Briefing Card */}
            <BriefingCard transactions={transactions} participants={participants} />
          </>
        )}

        {activeTab === 'people' && (
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Detailed Breakdown</h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto no-scrollbar">
              {Object.entries(stats.myPersonalBalances).filter(([, val]) => Math.abs(val) > 1).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">You are all settled up!</p>
              ) : (
                Object.entries(stats.myPersonalBalances).map(([uid, val]) => {
                  if (Math.abs(val) < 1) return null;
                  const p = participants.find(x => x.uniqueId === uid);
                  const name = p ? p.name : uid;

                  return (
                    /* REFACTORED: Stack vertically on mobile, row on tablet/desktop + cascade animation */
                    <div key={uid} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-4 bg-white/5 rounded-xl gap-3 border border-white/5 hover:border-white/10 transition-colors cascade-item">
                      <div className="flex items-center gap-3">
                        <UserAvatar name={name} uniqueId={uid} size="lg" />
                        <span className="font-medium text-gray-700 dark:text-gray-300 text-lg">
                          {name}
                        </span>
                      </div>

                      <div className="w-full sm:w-auto">
                        {val > 0 ? (
                          <div className="flex justify-end w-full">
                            <span className="font-semibold text-green-600">owes you {formatCurrency(val)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                            <span className="font-semibold text-red-600">you owe {formatCurrency(Math.abs(val))}</span>
                            <button
                              onClick={() => handleSettleUp(uid, val)}
                              className="flex items-center gap-2 text-sm bg-linear-to-r from-sky-500 to-indigo-500 text-white px-4 py-2 rounded-full hover:shadow-lg hover:shadow-sky-500/25 whitespace-nowrap shrink-0 transition-all font-medium"
                            >
                              Settle Up
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Smart Settle Suggestions */}
            <SmartSettle
              balances={stats.myPersonalBalances}
              participants={participants}
              onSettle={handleSettleUp}
            />
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Upcoming Recurring</h3>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar size={48} className="text-gray-500 mb-4" />
              <p className="text-gray-400 mb-2">Recurring transactions will appear here</p>
              <p className="text-gray-500 text-sm">Set up recurring items in Settings → Recurring</p>
            </div>
          </div>
        )}

        <ConfirmModal
          isOpen={showSummary}
          title="Who Owes Whom?"
          message={debtSummaryHtml}
          confirmText="Close"
          onConfirm={() => setShowSummary(false)}
          onCancel={() => setShowSummary(false)}
        />

        {/* --- INSERT: Recurring Modal --- */}
        {dueRecurringItem && (
          <ConfirmModal
            isOpen={showRecurModal}
            title={`Recurring Expense Due`}
            message={`Log payment for <b>${dueRecurringItem.name}</b> (${formatCurrency(dueRecurringItem.amount)})?`}
            confirmText="Yes, Log It"
            cancelText="Skip this Month"
            onConfirm={handleProcessRecurring}
            onCancel={handleSkipRecurring}
          />
        )}
      </div>
    </PullToRefresh>
  );
};

export default Dashboard;