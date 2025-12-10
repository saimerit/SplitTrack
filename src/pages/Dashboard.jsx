import { useMemo, useState, useEffect } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import CategoryDoughnut from '../components/charts/CategoryDoughnut';
import Button from '../components/common/Button';
import { useNavigate } from 'react-router-dom';
import ConfirmModal from '../components/modals/ConfirmModal';
import { checkDueRecurring, processRecurringTransaction, skipRecurringTransaction, addTransaction } from '../services/transactionService';
import { Timestamp } from 'firebase/firestore';

const Dashboard = () => {
  const navigate = useNavigate();
  const { transactions, participants, loading, templates, showToast } = useAppStore();
  const [showSummary, setShowSummary] = useState(false);

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

  // --- Core Balance Logic ---
  const stats = useMemo(() => {
    let myPersonalBalances = {};
    let netPosition = 0;
    let totalPaymentsMadeByMe = 0;
    let totalRepaymentsMadeToMe = 0;
    let myTotalExpenseShare = 0;
    let totalPaidByOthersForMe = 0;
    let monthlyIncome = 0;
    let categorySums = {};

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    participants.forEach(p => {
      if (p.uniqueId !== 'me') myPersonalBalances[p.uniqueId] = 0;
    });

    // Only process non-deleted transactions
    transactions
      .filter(t => !t.isDeleted)
      .forEach(txn => {
        const payer = txn.payer || 'me';
        const splits = txn.splits || {};
        const amount = txn.amount || 0;

        // Income Logic
        if (txn.type === 'income') {
          if (txn.timestamp) {
            // Handle both Firestore Timestamp and Date objects for robustness
            const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
              monthlyIncome += (amount / 100);
            }
          }
          return;
        }

        if (txn.isReturn) {
          const recipient = txn.participants?.[0];

          // Guard clause: skip if data is malformed
          if (!recipient) return;

          if (payer === 'me') {
            // Case 1: You paid someone (You settle up or lend money)
            if (recipient !== 'me') {
              myPersonalBalances[recipient] = (myPersonalBalances[recipient] || 0) + amount;
              totalPaymentsMadeByMe += amount;
            }
          } else {
            // Case 2: Someone else paid YOU (They settle up or lend you money)
            if (recipient === 'me') {
              myPersonalBalances[payer] = (myPersonalBalances[payer] || 0) - amount;
              totalRepaymentsMadeToMe += amount;
            }
          }
        }
        else {
          if (payer === 'me') {
            totalPaymentsMadeByMe += amount;
            Object.entries(splits).forEach(([uid, share]) => {
              if (uid === 'me') {
                myTotalExpenseShare += share;
                const cat = txn.category || 'Uncategorized';
                categorySums[cat] = (categorySums[cat] || 0) + share;
              } else {
                myPersonalBalances[uid] = (myPersonalBalances[uid] || 0) + share;
              }
            });
          } else {
            const myShare = splits['me'] || 0;
            if (myShare > 0) {
              myPersonalBalances[payer] = (myPersonalBalances[payer] || 0) - myShare;
              myTotalExpenseShare += myShare;
              totalPaidByOthersForMe += myShare;
              const cat = txn.category || 'Uncategorized';
              categorySums[cat] = (categorySums[cat] || 0) + myShare;
            }
          }
        }
      });

    netPosition = Object.values(myPersonalBalances).reduce((sum, val) => sum + val, 0);

    const chartData = Object.entries(categorySums)
      .map(([label, val]) => ({ label, value: val / 100 }))
      .sort((a, b) => b.value - a.value);

    return {
      netPosition,
      myPersonalBalances,
      myTotalExpenditure: totalPaymentsMadeByMe - totalRepaymentsMadeToMe,
      myTotalShare: myTotalExpenseShare,
      paidByOthers: totalPaidByOthersForMe,
      monthlyIncome,
      chartData
    };

  }, [transactions, participants]);

  const handleSettleUp = (uid, amount) => {
    navigate('/add', {
      state: {
        type: 'expense',
        isReturn: true,
        payer: 'me',
        participants: [uid],
        amount: Math.abs(amount / 100),
        description: 'Settlement'
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

  if (loading) return <div className="text-center text-gray-500 mt-10">Calculating balances...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200">Balances</h2>
        <Button variant="primary" onClick={() => setShowSummary(true)}>
          Who Owes Whom?
        </Button>
      </div>

      {/* --- INSERT: Quick Add Shortcuts --- */}
      {pinnedTemplates.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Add</h3>
          <div className="flex flex-wrap gap-3">
            {pinnedTemplates.map(t => (
              <button
                key={t.id}
                onClick={() => handleQuickAdd(t)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full shadow-sm hover:shadow-md hover:border-sky-500 transition-all text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                <span>⚡</span>
                <span>{t.expenseName || t.description}</span>
                <span className="text-xs text-gray-400">({formatCurrency(t.amount)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Your Net Position</h3>
          <div className={`text-2xl sm:text-3xl lg:text-4xl font-bold mt-2 ${stats.netPosition > 0 ? 'text-green-600' : stats.netPosition < 0 ? 'text-red-600' : 'text-gray-800 dark:text-gray-200'
            }`}>
            {formatCurrency(stats.netPosition)}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {stats.netPosition > 0 ? "You are owed money" : "You owe money"}
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Income (This Month)</h3>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-2 text-emerald-500">
            {formatCurrency(stats.monthlyIncome * 100)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Total Expenditure</h3>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-2 text-blue-600">
            {formatCurrency(stats.myTotalExpenditure)}
          </div>
          <p className="text-xs text-gray-400 mt-1">Total payments - Repayments</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">My Total Share</h3>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-2 text-purple-600">
            {formatCurrency(stats.myTotalShare)}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">Paid By Others</h3>
          <div className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-2 text-orange-600">
            {formatCurrency(stats.paidByOthers)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 md:col-span-2">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">Detailed Breakdown</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar">
            {Object.entries(stats.myPersonalBalances).filter(([, val]) => Math.abs(val) > 1).length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">You are all settled up!</p>
            ) : (
              Object.entries(stats.myPersonalBalances).map(([uid, val]) => {
                if (Math.abs(val) < 1) return null;
                const p = participants.find(x => x.uniqueId === uid);
                const name = p ? p.name : uid;

                return (
                  /* REFACTORED: Stack vertically on mobile, row on tablet/desktop */
                  <div key={uid} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg gap-2">
                    <span className="font-medium text-gray-700 dark:text-gray-300 wrap-break-word text-lg sm:text-base">
                      {name}
                    </span>

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
                            className="text-xs bg-sky-600 text-white px-3 py-1.5 rounded hover:bg-sky-700 whitespace-nowrap shrink-0 transition-colors"
                          >
                            Settle
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700 md:col-span-1">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">My Share by Category</h3>
          <div className="h-48 md:h-64 relative">
            {stats.chartData.length > 0 ? (
              <CategoryDoughnut data={stats.chartData} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">No data</div>
            )}
          </div>
        </div>

      </div>

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
  );
};

export default Dashboard;