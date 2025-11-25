export const runLedgerIntegrityChecks = (transactions, participants) => {
  const report = [];
  let issues = 0;

  const log = (msg, type = 'warning') => {
    report.push({ type, message: msg });
    if (type === 'warning' || type === 'error') issues++;
  };

  // 1. Auto-verify parent–child relationships
  transactions.filter(t => t.isLinkedRefund).forEach(refund => {
    const parent = transactions.find(p => p.id === refund.parentTransactionId);
    if (!parent) {
      log(`Orphan refund found: ID ${refund.id} links to missing parent ${refund.parentTransactionId}`, 'error');
    }
  });

  // 2. Auto-check netAmount consistency (Parent expenses)
  transactions.filter(t => !t.isLinkedRefund && !t.isReturn && t.type === 'expense').forEach(parent => {
    const children = transactions.filter(r => r.parentTransactionId === parent.id);
    const totalRefunds = children.reduce((sum, r) => sum + r.amount, 0); // Refunds are negative
    const expectedNet = parent.amount + totalRefunds;
    
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