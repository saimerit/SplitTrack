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
        // Use stored date string if available, otherwise fallback to timestamp calculation
        const date = txn.dateString ? new Date(txn.dateString) : getDateFromMillis(txn.timestamp);
        if (isNaN(date.getTime())) return;

        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const day = date.getDate();

        // --- Calculate Base Amounts ---
        const rawAmount = Number(txn.amount) || 0;
        const amountIPaid = (txn.payer === 'me') ? (rawAmount / 100) : 0;
        let myConsumption = 0;

        if (txn.type === 'income') {
            // Income logic remains same
            totalIncome += amountIPaid;
        } else {
            // Expense Logic
            if (txn.splits && Object.keys(txn.splits).length > 0) {
                // If splits exist, strictly trust them
                const myShare = Number(txn.splits['me']) || 0;
                myConsumption = myShare / 100;
            } else if (txn.payer === 'me') {
                // No splits: If I paid, did I pay for myself or everyone?
                // Logic: If there are other participants defined but no splits, it's ambiguous.
                // But standard app behavior for 'No Splits' usually implies 'Split Equally' or 'Paid for All'?
                // Safe default: If I paid and no splits object, assume I consumed it ALL unless logic dictates otherwise.
                // However, to differentiate "Lent", we must be careful.
                // If I paid 100 and participants = [Me, You], usually splits should be {me:50, you:50}.
                // If splits is missing, we assume 100% my consumption to be safe, avoiding "Lent" accidental classification.
                myConsumption = (rawAmount / 100);
            }
        }

        // --- Running Balance ---
        runningBalance += (amountIPaid - myConsumption);
        balanceLabels.push(dateStr);
        balancePoints.push(runningBalance);

        if (amountIPaid > 0 || myConsumption > 0) {
            activeDays.add(date.toDateString());
        }

        // --- Heatmap Logic ---
        if (monthKey === currentMonthKey && day >= 1 && day <= 31) {
            let flow = 0;
            const safeAmt = Number(txn.amount) || 0;
            if (txn.type === 'income') {
                flow -= safeAmt / 100;
            } else {
                if (txn.payer === 'me') {
                    flow += safeAmt / 100;
                }
                if (txn.isReturn && txn.participants.includes('me') && txn.payer !== 'me') {
                    flow -= safeAmt / 100;
                }
            }
            heatmapData[day] += flow;
        }

        // 1. Lending Logic (Revised)
        // Lent is strictly what I paid minus what I consumed.
        // If result is negative (someone else paid for me), it's Borrowed (not tracked in 'Lent' total usually, but net position).
        // Here we track "Total Lent" (Outflow for others).
        let lent = 0;
        if (txn.payer === 'me') {
            lent = Math.max(0, amountIPaid - myConsumption);
            if (lent > 0.01) {
                totalLent += lent;
                monthlyLentStats[monthKey] = (monthlyLentStats[monthKey] || 0) + lent;
                monthlyTotalStats[monthKey] = (monthlyTotalStats[monthKey] || 0) + lent; // Total Outflow tracks Lent + Spend

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
                participantShareStats[name] = (participantShareStats[name] || 0) + ((Number(sharePaise) || 0) / 100);
            });
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
        const dateObj = new Date(parseInt(y), parseInt(m) - 1);
        return dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    peakSpendMonth = formatMonth(peakSpendMonth);
    peakOutflowMonth = formatMonth(peakOutflowMonth);

    const totalActivityAllTime = totalSpend + totalLent;
    const avgMonthly = monthlyKeys.length > 0 ? (totalActivityAllTime / monthlyKeys.length) : 0;

    const monthlyChartLabels = monthlyKeys.map(k => {
        const [y, m] = k.split('-');
        return new Date(y, m - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    });

    // Forecasts
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysPassed = Math.max(1, now.getDate());
    const projectedSpend = (currentMonthSpend / daysPassed) * daysInMonth;
    const forecastSpendPercent = projectedSpend > 0 ? Math.min(100, (currentMonthSpend / projectedSpend) * 100) : 0;
    const projectedLending = (currentMonthLent / daysPassed) * daysInMonth;
    const forecastLentPercent = projectedLending > 0 ? Math.min(100, (currentMonthLent / projectedLending) * 100) : 0;

    const sortedCats = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
    const sortedPlaces = Object.entries(placeStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const sortedCurrentCats = Object.entries(currentMonthCatStats).sort((a, b) => b[1] - a[1]);
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