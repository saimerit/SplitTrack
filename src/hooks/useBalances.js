import { useMemo } from 'react';

export const useBalances = (transactions, participants) => {
    return useMemo(() => {
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

        // Initialize balances
        participants.forEach(p => {
            if (p.uniqueId !== 'me') myPersonalBalances[p.uniqueId] = 0;
        });

        transactions
            .filter(t => !t.isDeleted)
            .forEach(txn => {
                const payer = txn.payer || 'me';
                const splits = txn.splits || {};
                const amount = parseFloat(txn.amount) || 0; // Ensure number

                // Income Logic
                if (txn.type === 'income') {
                    // Handle various date formats (Firestore Timestamp, Date object, or string)
                    let d;
                    if (txn.timestamp?.toDate) d = txn.timestamp.toDate();
                    else if (txn.timestamp instanceof Date) d = txn.timestamp;
                    else d = new Date(txn.timestamp || Date.now());

                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                        monthlyIncome += (amount / 100);
                    }
                    return;
                }

                if (txn.isReturn) {
                    const recipient = txn.participants?.[0];
                    if (!recipient) return;

                    if (payer === 'me') {
                        if (recipient !== 'me') {
                            myPersonalBalances[recipient] = (myPersonalBalances[recipient] || 0) + amount;
                            totalPaymentsMadeByMe += amount;
                        }
                    } else {
                        if (recipient === 'me') {
                            myPersonalBalances[payer] = (myPersonalBalances[payer] || 0) - amount;
                            totalRepaymentsMadeToMe += amount;
                        }
                    }
                } else {
                    // Expense Logic
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
};
