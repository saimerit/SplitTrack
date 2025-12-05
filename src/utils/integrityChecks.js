export const runLedgerIntegrityChecks = (transactions, participants) => {
  const report = [];
  let issues = 0;

  const log = (msg, type = 'warning') => {
    report.push({ type, message: msg });
    if (type === 'warning' || type === 'error') issues++;
  };

  // 1. Auto-verify parent–child relationships
  transactions.filter(t => t.isLinkedRefund).forEach(refund => {
    // Check primary parent
    if (refund.parentTransactionId) {
        const parent = transactions.find(p => p.id === refund.parentTransactionId);
        if (!parent) {
          log(`Orphan refund found: ID ${refund.id} links to missing parent ${refund.parentTransactionId}`, 'error');
        }
    }
    // Check array parents (New System)
    if (refund.parentTransactionIds && Array.isArray(refund.parentTransactionIds)) {
        refund.parentTransactionIds.forEach(pid => {
            const parent = transactions.find(p => p.id === pid);
            if (!parent) {
                log(`Orphan refund link found: Refund ${refund.id} links to missing parent ${pid}`, 'error');
            }
        });
    }
  });

  // 2. Auto-check netAmount consistency (Parent expenses)
  // FIXED: Updated to support multi-parent refunds and partial allocations
  transactions.filter(t => !t.isLinkedRefund && !t.isReturn && t.type === 'expense').forEach(parent => {
    
    // Find all refunds linked to this parent (Legacy or New)
    const children = transactions.filter(r => {
        // Must be a negative amount (refund) and not a settlement
        if (r.isReturn || r.type === 'income' || r.amount >= 0) return false;

        // Check Legacy Link
        if (r.parentTransactionId === parent.id) return true;

        // Check New Array Link
        if (r.parentTransactionIds && Array.isArray(r.parentTransactionIds) && r.parentTransactionIds.includes(parent.id)) return true;

        return false;
    });

    const totalRefunds = children.reduce((sum, r) => {
        let allocated = 0;
        
        // Logic matching transactionService.js updateParentStats
        // Use specific allocation if available, otherwise fallback to full amount
        if (r.linkedTransactions && Array.isArray(r.linkedTransactions) && r.linkedTransactions.length > 0) {
            const link = r.linkedTransactions.find(l => l.id === parent.id);
            allocated = link ? link.amount : r.amount;
        } else {
            allocated = r.amount;
        }
        
        return sum + allocated;
    }, 0);

    const expectedNet = parent.amount + totalRefunds; // Refunds are negative, so this subtracts
    
    // Tolerance of 1 paise
    if (parent.netAmount !== undefined && Math.abs(parent.netAmount - expectedNet) > 1) {
      log(`Net Amount mismatch for "${parent.expenseName}". Stored: ${parent.netAmount}, Calc: ${expectedNet}`);
    }
  });

  // 3. Validate participants reference
  const participantIds = new Set(participants.map(p => p.uniqueId));
  participantIds.add('me');

  transactions.forEach(t => {
    if (t.payer !== 'me' && !participantIds.has(t.payer)) {
      log(`Txn "${t.expenseName}": Unknown payer '${t.payer}'`);
    }
    if (t.participants) {
      t.participants.forEach(pId => {
        if (pId !== 'me' && !participantIds.has(pId)) {
          log(`Txn "${t.expenseName}": Unknown participant '${pId}'`);
        }
      });
    }
  });

  // 4. Validate amount & splits integrity
  transactions.forEach(t => {
    if (!t.isReturn && t.type !== 'income' && t.splits && Object.keys(t.splits).length > 0) {
      const totalSplit = Object.values(t.splits).reduce((a, b) => a + b, 0);
      if (Math.abs(Math.abs(totalSplit) - Math.abs(t.amount)) > 1) {
        log(`Split mismatch in "${t.expenseName}". Total: ${t.amount}, Split Sum: ${totalSplit}`);
      }
    }
  });

  return { issues, report };
};