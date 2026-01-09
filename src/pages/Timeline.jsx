import { useMemo, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { formatCurrency } from '../utils/formatters';
import Select from '../components/common/Select';

const Timeline = () => {
  const { transactions, participantsLookup } = useAppStore();
  const [selectedParticipant, setSelectedParticipant] = useState('all');

  // Helper to get participant name from ID
  const getParticipantName = (id) => {
    if (id === 'me') return 'You';
    const participant = participantsLookup.get(id);
    return participant?.name || id;
  };

  // Calculate participant summary for debt/credit breakdown
  const participantSummary = useMemo(() => {
    const summary = {};

    // Helper to ensure participant exists in summary
    const ensureParticipant = (person) => {
      if (!summary[person]) {
        summary[person] = { totalOwedToMe: 0, totalIOwe: 0, txns: [] };
      }
    };

    transactions.forEach(txn => {
      // Handle RETURN/SETTLEMENT transactions
      if (txn.isReturn) {
        const payer = txn.payer || 'me';
        const recipient = txn.participants?.[0];
        const amount = Math.abs(txn.amount) || 0;

        if (!recipient || recipient === payer) return;

        // If I paid someone back (settling what I owed them)
        if (payer === 'me' && recipient !== 'me') {
          ensureParticipant(recipient);
          summary[recipient].totalIOwe -= amount; // Reduces my debt
          summary[recipient].txns.push({
            ...txn,
            participantType: 'settlement-out',
            participantAmount: amount
          });
        }
        // If someone paid me back (settling what they owed me)
        else if (payer !== 'me' && recipient === 'me') {
          ensureParticipant(payer);
          summary[payer].totalOwedToMe -= amount; // Reduces their debt
          summary[payer].txns.push({
            ...txn,
            participantType: 'settlement-in',
            participantAmount: amount
          });
        }
        return;
      }

      // Handle regular EXPENSE transactions with splits
      if (!txn.splits) return;

      const payer = txn.payer || 'me';
      const myShare = txn.splits.me || 0;

      // Case 1: I paid - each participant owes me their share
      if (payer === 'me') {
        Object.entries(txn.splits).forEach(([person, amount]) => {
          if (person === 'me') return;
          ensureParticipant(person);
          summary[person].totalOwedToMe += amount;
          summary[person].txns.push({ ...txn, participantType: 'credit', participantAmount: amount });
        });
      }
      // Case 2: Someone else paid and I have a share - I owe them
      else if (payer !== 'me' && myShare > 0) {
        ensureParticipant(payer);
        summary[payer].totalIOwe += myShare;
        summary[payer].txns.push({ ...txn, participantType: 'debt', participantAmount: myShare });
      }
    });
    return summary;
  }, [transactions]);

  // Get unique participant names for dropdown
  const participantOptions = useMemo(() => {
    const participants = Object.keys(participantSummary);
    return [
      { value: 'all', label: 'All Participants' },
      ...participants.map(p => ({ value: p, label: getParticipantName(p) }))
    ];
  }, [participantSummary, participantsLookup]);

  // Group transactions by date (filtered by participant if selected)
  const groups = useMemo(() => {
    const grouped = {};

    let txnsToGroup = transactions;

    // If a specific participant is selected, only show their transactions
    if (selectedParticipant !== 'all' && participantSummary[selectedParticipant]) {
      txnsToGroup = participantSummary[selectedParticipant].txns;
    }

    const sorted = [...txnsToGroup].sort((a, b) => {
      const tA = a.timestamp?.toMillis ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime();
      const tB = b.timestamp?.toMillis ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime();
      return tB - tA; // Descending order
    });

    sorted.forEach(txn => {
      if (!txn.timestamp) return;
      const dateStr = txn.timestamp.toDate().toDateString();
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(txn);
    });
    return grouped;
  }, [transactions, selectedParticipant, participantSummary]);

  const todayStr = new Date().toDateString();

  if (transactions.length === 0) return <div className="text-center text-gray-500 mt-10">No timeline data.</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-20">
      {/* Header with Participant Filter */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-sky-400 to-blue-400">Timeline</h2>
            <p className="text-gray-400 mt-1">A chronological view of your transactions</p>
          </div>
          {participantOptions.length > 1 && (
            <Select
              label="Filter by Participant"
              value={selectedParticipant}
              onChange={(e) => setSelectedParticipant(e.target.value)}
              options={participantOptions}
              className="w-full sm:w-48"
            />
          )}
        </div>
      </div>

      {/* Balance Summary Card - shown when participant is selected */}
      {selectedParticipant !== 'all' && participantSummary[selectedParticipant] && (() => {
        const data = participantSummary[selectedParticipant];
        const netBalance = data.totalOwedToMe - data.totalIOwe;
        const isPositive = netBalance >= 0;
        const participantName = getParticipantName(selectedParticipant);

        return (
          <div className="glass-card p-6 md:p-8">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">
              Balance with {participantName}
            </h3>

            {/* Net Balance - Primary Display */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
              <p className="text-xs text-gray-400 mb-1">Net Balance</p>
              <p className={`text-2xl font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {isPositive ? '+' : ''}{formatCurrency(netBalance)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {netBalance > 0 ? `${participantName} owes you` :
                  netBalance < 0 ? `You owe ${participantName}` :
                    'Settled up'}
              </p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-[10px] text-gray-400 mb-1">They Owe You</p>
                <p className="text-lg font-bold text-green-500">
                  {formatCurrency(data.totalOwedToMe)}
                </p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <p className="text-[10px] text-gray-400 mb-1">You Owe Them</p>
                <p className="text-lg font-bold text-red-500">
                  {formatCurrency(data.totalIOwe)}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Timeline content with vertical line */}
      <div className="relative before:absolute before:inset-0 before:ml-4 md:before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-white/20 before:to-transparent">

        {Object.entries(groups).map(([dateStr, txns]) => (
          <div key={dateStr} className="relative">
            {/* Date Header */}
            <div className="sticky top-20 z-20 mb-6 pt-2">
              {/* Dot */}
              <div className="absolute top-1/2 -translate-y-1/2 left-4 md:left-5 -translate-x-1/2 h-3 w-3 md:h-4 md:w-4 rounded-full border-2 border-white/20 z-20 box-content" style={{ backgroundColor: 'var(--primary)' }}></div>

              {/* Date Text */}
              <h3 className="ml-12 md:ml-12 inline-block text-xs sm:text-sm font-bold text-gray-100 bg-white/10 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10 shadow-sm relative z-30">
                {dateStr === todayStr ? "Today" : dateStr}
              </h3>
            </div>

            {/* Transactions List */}
            <div className="ml-12 md:ml-12 space-y-4">
              {txns.map(txn => {
                const isReturn = txn.isReturn;
                const isRefund = txn.amount < 0;
                const isIncome = txn.type === 'income';

                let sign = '-';
                let colorClass = 'text-gray-200';
                let amountVal = Math.abs(txn.amount / 100);

                if (isRefund || isIncome) {
                  sign = '+';
                  colorClass = 'text-green-500';
                } else if (isReturn) {
                  if (txn.payer === 'me') { sign = '-'; colorClass = 'text-red-500'; }
                  else { sign = '+'; colorClass = 'text-green-500'; }
                }

                const myShare = txn.splits?.me ? (txn.splits.me / 100) : 0;
                const shareText = isRefund ? `+₹${Math.abs(myShare).toFixed(2)}` : `₹${myShare.toFixed(2)}`;

                // Participant-specific display when filtered
                const hasParticipantData = selectedParticipant !== 'all' && txn.participantType;
                const participantAmountFormatted = txn.participantAmount ? formatCurrency(txn.participantAmount) : '';

                return (
                  <div key={txn.id} className="glass-card p-3 sm:p-4 flex justify-between items-center relative z-10">
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-gray-100 text-sm sm:text-base truncate">{txn.expenseName}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {txn.category || 'Uncategorized'} • {txn.modeOfPayment || 'Cash'}
                        {txn.place && ` • ${txn.place}`}
                      </p>
                      {/* Participant-specific indicator */}
                      {hasParticipantData && (
                        <p className={`text-[10px] sm:text-xs mt-1 font-medium ${txn.participantType === 'credit' ? 'text-green-500' :
                          txn.participantType === 'settlement-in' ? 'text-blue-400' :
                            txn.participantType === 'settlement-out' ? 'text-blue-400' :
                              'text-red-500'
                          }`}>
                          {txn.participantType === 'credit' && `${getParticipantName(selectedParticipant)} owes: ${participantAmountFormatted}`}
                          {txn.participantType === 'debt' && `You owe: ${participantAmountFormatted}`}
                          {txn.participantType === 'settlement-out' && `You settled: ${participantAmountFormatted}`}
                          {txn.participantType === 'settlement-in' && `${getParticipantName(selectedParticipant)} settled: ${participantAmountFormatted}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-bold text-sm sm:text-base ${colorClass}`}>{sign}₹{formatCurrency(amountVal * 100).replace('₹', '')}</p>
                      {!hasParticipantData && myShare !== 0 && !isReturn && !isIncome && (
                        <p className={`text-[10px] sm:text-xs ${isRefund ? 'text-green-500' : 'text-gray-400'}`}>
                          My Share: {shareText}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Timeline;