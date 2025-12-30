/**
 * Apply smart tagging rules to transaction data before saving.
 * Rules match keywords in the expense name and auto-fill category/tag/mode.
 */
export const applySmartRules = (txnData, rules = []) => {
    if (!rules || rules.length === 0 || !txnData.expenseName) {
        return txnData;
    }

    let refined = { ...txnData };
    const nameLower = txnData.expenseName.toLowerCase();

    rules.forEach(rule => {
        if (!rule.keyword) return;

        if (nameLower.includes(rule.keyword.toLowerCase())) {
            // Only apply if the field is empty or if the rule is set to override
            if (rule.targetCategory && !refined.category) {
                refined.category = rule.targetCategory;
            }
            if (rule.targetTag && !refined.tag) {
                refined.tag = rule.targetTag;
            }
            if (rule.targetMode && !refined.modeOfPayment) {
                refined.modeOfPayment = rule.targetMode;
            }
            if (rule.targetPlace && !refined.place) {
                refined.place = rule.targetPlace;
            }
        }
    });

    return refined;
};

/**
 * Run data health checks and return categorized issues
 */
export const runDataHealthScan = (transactions, participants) => {
    const issues = {
        orphanedRefunds: [],
        missingCategory: [],
        missingPaymentMode: [],
        invalidAmounts: [],
        total: 0
    };

    const txnIds = new Set(transactions.map(t => t.id));
    const participantIds = new Set(participants.map(p => p.uniqueId));
    participantIds.add('me');

    transactions.forEach(txn => {
        if (txn.isDeleted) return;

        // Check for orphaned refunds
        if (txn.isLinkedRefund || txn.parentTransactionId) {
            const parentId = txn.parentTransactionId;
            if (parentId && !txnIds.has(parentId)) {
                issues.orphanedRefunds.push({
                    id: txn.id,
                    name: txn.expenseName,
                    issue: `Missing parent: ${parentId}`
                });
                issues.total++;
            }
        }

        // Check for missing category (for expenses)
        if (txn.type === 'expense' && !txn.isReturn && !txn.category) {
            issues.missingCategory.push({
                id: txn.id,
                name: txn.expenseName
            });
            issues.total++;
        }

        // Check for missing payment mode (for expenses)
        if (txn.type === 'expense' && !txn.isReturn && !txn.modeOfPayment) {
            issues.missingPaymentMode.push({
                id: txn.id,
                name: txn.expenseName
            });
            issues.total++;
        }

        // Check for invalid amounts (negative netAmount for non-refunds)
        if (!txn.isReturn && txn.type === 'expense' && txn.netAmount !== undefined && txn.netAmount < 0) {
            issues.invalidAmounts.push({
                id: txn.id,
                name: txn.expenseName,
                netAmount: txn.netAmount
            });
            issues.total++;
        }
    });

    return issues;
};
