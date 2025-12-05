// src/workers/analytics.worker.js

self.onmessage = (e) => {
  const { transactions, participantsLookup } = e.data;

  // Convert plain object/array back to Map for easier lookup if needed, 
  // though for read-only access a simple object map is often faster in workers.
  const participantsMap = new Map(participantsLookup);

  const monthlySpendStats = {};
  const monthlyLentStats = {};
  const monthlyTotalStats = {};
  const monthlyReceivedStats = {};
  
  const categoryStats = {};
  const placeStats = {};
  const participantShareStats = {};
  
  const currentMonthCatStats = {};
  const heatmapData = new Array(32).fill(0); 
  const activeDays = new Set();
  
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  let totalSpend = 0;     
  let totalLent = 0;      
  let totalRepaymentSent = 0; 
  let totalReceived = 0;
  let totalIncome = 0;
  
  let currentMonthSpend = 0;
  let currentMonthLent = 0;
  
  const balanceLabels = [];
  const balancePoints = [];
  let runningBalance = 0;

  // Helper to safely parse date from serialized timestamp (millis)
  const getDateFromMillis = (ms) => new Date(ms);

  // Sorting
  const sortedTxns = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

  sortedTxns.forEach(txn => {
    if (!txn.timestamp) return;
    const date = getDateFromMillis(txn.timestamp);
    if (isNaN(date.getTime())) return;

    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const day = date.getDate();

    // --- Calculate Base Amounts ---
    let amountIPaid = (txn.payer === 'me') ? (txn.amount / 100) : 0;
    let myConsumption = 0;
    
    if (txn.type === 'income') {
        amountIPaid = (txn.amount / 100); 
        totalIncome += amountIPaid;
    } else if (txn.splits && txn.splits['me'] !== undefined) {
        myConsumption = txn.splits['me'] / 100;
    } else if (txn.payer === 'me' && (!txn.splits || Object.keys(txn.splits).length === 0)) {
        if (txn.participants && txn.participants.length > 0) {
           myConsumption = 0; 
        } else {
           myConsumption = (txn.amount / 100);
        }
    }

    runningBalance += (amountIPaid - myConsumption);
    balanceLabels.push(dateStr);
    balancePoints.push(runningBalance);

    if (amountIPaid > 0 || myConsumption > 0) {
        activeDays.add(date.toDateString());
    }

    // --- Heatmap Logic ---
    if (monthKey === currentMonthKey && day >= 1 && day <= 31) {
        let flow = 0;
        if (txn.type === 'income') {
            flow -= (txn.amount / 100);
        } else {
            if (txn.payer === 'me') {
                flow += (txn.amount / 100);
            }
            if (txn.isReturn && txn.participants.includes('me') && txn.payer !== 'me') {
                flow -= (txn.amount / 100);
            }
        }
        heatmapData[day] += flow;
    }

    // --- Detailed Stats ---
    if (txn.type !== 'income') {
        if (txn.isReturn) {
            if (txn.payer === 'me') {
                totalRepaymentSent += (txn.amount / 100);
            } else if (txn.participants.includes('me') || txn.payer !== 'me') {
                if (txn.participants.includes('me')) {
                    totalReceived += (txn.amount / 100);
                    monthlyReceivedStats[monthKey] = (monthlyReceivedStats[monthKey] || 0) + (txn.amount / 100);
                }
            }
        } else {
            // 1. Lending
            if (txn.payer === 'me') {
                const lent = amountIPaid - myConsumption;
                if (lent > 0.01) {
                    totalLent += lent;
                    monthlyLentStats[monthKey] = (monthlyLentStats[monthKey] || 0) + lent;
                    monthlyTotalStats[monthKey] = (monthlyTotalStats[monthKey] || 0) + lent;
                    
                    if (monthKey === currentMonthKey) currentMonthLent += lent;
                }
            }

            // 2. Spending
            if (Math.abs(myConsumption) > 0.001) {
                totalSpend += myConsumption;
                monthlySpendStats[monthKey] = (monthlySpendStats[monthKey] || 0) + myConsumption;
                monthlyTotalStats[monthKey] = (monthlyTotalStats[monthKey] || 0) + myConsumption;

                const place = txn.place || 'Unknown';
                placeStats[place] = (placeStats[place] || 0) + myConsumption;
                
                const cat = txn.category || 'Uncategorized';
                categoryStats[cat] = (categoryStats[cat] || 0) + myConsumption;

                if (monthKey === currentMonthKey) {
                    currentMonthSpend += myConsumption;
                    currentMonthCatStats[cat] = (currentMonthCatStats[cat] || 0) + myConsumption;
                }
            }

            // 3. Participants
            if (txn.splits) {
                Object.entries(txn.splits).forEach(([uid, sharePaise]) => {
                    const pData = participantsMap.get(uid);
                    const name = uid === 'me' ? 'You' : (pData?.name || uid);
                    participantShareStats[name] = (participantShareStats[name] || 0) + (sharePaise / 100);
                });
            }
        }
    }
  });

  // --- Aggregation & Peaks ---
  const allMonthKeys = new Set([
      ...Object.keys(monthlySpendStats), 
      ...Object.keys(monthlyLentStats)
  ]);
  const monthlyKeys = Array.from(allMonthKeys).sort();
  
  let peakSpendMonth = '-'; 
  let peakSpendAmount = 0;
  let peakOutflowMonth = '-';
  let peakOutflowAmount = 0;

  monthlyKeys.forEach(k => {
      const spend = monthlySpendStats[k] || 0;
      if (spend > peakSpendAmount) {
          peakSpendAmount = spend;
          peakSpendMonth = k;
      }
      const total = monthlyTotalStats[k] || 0;
      if (total > peakOutflowAmount) {
          peakOutflowAmount = total;
          peakOutflowMonth = k;
      }
  });
  
  const formatMonth = (k) => {
      if (k === '-') return '-';
      const [y, m] = k.split('-');
      const dateObj = new Date(parseInt(y), parseInt(m)-1);
      return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  peakSpendMonth = formatMonth(peakSpendMonth);
  peakOutflowMonth = formatMonth(peakOutflowMonth);
  
  const totalActivityAllTime = totalSpend + totalLent;
  const avgMonthly = monthlyKeys.length > 0 ? (totalActivityAllTime / monthlyKeys.length) : 0;
  
  const monthlyChartLabels = monthlyKeys.map(k => {
      const [y, m] = k.split('-');
      return new Date(y, m-1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  });

  // Forecasts
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = Math.max(1, now.getDate());
  const projectedSpend = (currentMonthSpend / daysPassed) * daysInMonth;
  const forecastSpendPercent = projectedSpend > 0 ? Math.min(100, (currentMonthSpend / projectedSpend) * 100) : 0;
  const projectedLending = (currentMonthLent / daysPassed) * daysInMonth;
  const forecastLentPercent = projectedLending > 0 ? Math.min(100, (currentMonthLent / projectedLending) * 100) : 0;

  const sortedCats = Object.entries(categoryStats).sort((a,b) => b[1] - a[1]);
  const sortedPlaces = Object.entries(placeStats).sort((a,b) => b[1] - a[1]).slice(0, 10);
  const sortedCurrentCats = Object.entries(currentMonthCatStats).sort((a,b) => b[1] - a[1]);
  const customCashFlow = (totalSpend + totalLent) - totalReceived;

  const result = {
    totalSpend, totalLent, totalRepaymentSent, totalReceived, totalIncome,
    customCashFlow, 
    activeDays: activeDays.size,
    peakSpendMonth, peakSpendAmount,
    peakOutflowMonth, peakOutflowAmount,
    avgMonthly,
    currentMonthSpend, currentMonthLent,
    projectedSpend, forecastSpendPercent,
    projectedLending, forecastLentPercent,
    heatmapData,
    monthlyChart: { 
        labels: monthlyChartLabels, 
        spendData: monthlyKeys.map(k => monthlySpendStats[k] || 0),
        lentData: monthlyKeys.map(k => monthlyLentStats[k] || 0),
        receivedData: monthlyKeys.map(k => monthlyReceivedStats[k] || 0)
    },
    netBalanceChart: { labels: balanceLabels, data: balancePoints },
    categoryData: sortedCats.map(([k, v]) => ({ label: k, value: v })),
    currentMonthBreakdown: sortedCurrentCats,
    participantData: participantShareStats,
    placeData: { 
        labels: sortedPlaces.map(i => i[0]), 
        datasets: [{
            label: 'My Spend',
            data: sortedPlaces.map(i => i[1]),
            backgroundColor: '#6366f1',
            borderRadius: 4
        }]
    }
  };

  self.postMessage(result);
};