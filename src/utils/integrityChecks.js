export const runLedgerIntegrityChecks = (transactions, participants) => {
  console.groupCollapsed("🔐 Ledger Integrity Checks");
  let issues = 0;

  // 1. Auto-verify parent–child relationships
  transactions.filter(t => t.isLinkedRefund).forEach(refund => {
    const parent = transactions.find(p => p.id === refund.parentTransactionId);
    if (!parent) {
      console.warn(`Orphan refund found: ID ${refund.id} links to missing parent ${refund.parentTransactionId}`);
      issues++;
    }
  });

  // 2. Auto-check netAmount consistency (Parent expenses)
  transactions.filter(t => !t.isLinkedRefund && !t.isReturn && t.type === 'expense').forEach(parent => {
    const children = transactions.filter(r => r.parentTransactionId === parent.id);
    const totalRefunds = children.reduce((sum, r) => sum + r.amount, 0); // Refunds are negative
    const expectedNet = parent.amount + totalRefunds;
    
    // Tolerance of 1 paise
    if (parent.netAmount !== undefined && Math.abs(parent.netAmount - expectedNet) > 1) {
      console.warn(`Net Amount mismatch for ${parent.expenseName}. Stored: ${parent.netAmount}, Calc: ${expectedNet}`);
      issues++;
    }
  });

  // 3. Validate participants reference
  const participantIds = new Set(participants.map(p => p.uniqueId));
  participantIds.add('me');

  transactions.forEach(t => {
    if (t.payer !== 'me' && !participantIds.has(t.payer)) {
      console.warn(`Txn ${t.id}: Unknown payer '${t.payer}'`);
      issues++;
    }
    if (t.participants) {
      t.participants.forEach(pId => {
        if (pId !== 'me' && !participantIds.has(pId)) {
          console.warn(`Txn ${t.id}: Unknown participant '${pId}'`);
          issues++;
        }
      });
    }
  });

  // 4. Validate amount & splits integrity
  transactions.forEach(t => {
    if (!t.isReturn && t.type !== 'income' && t.splits && Object.keys(t.splits).length > 0) {
      const totalSplit = Object.values(t.splits).reduce((a, b) => a + b, 0);
      // Compare absolute values to handle refunds correctly
      if (Math.abs(Math.abs(totalSplit) - Math.abs(t.amount)) > 1) {
        console.warn(`Split mismatch ${t.id}. Total: ${t.amount}, Split Sum: ${totalSplit}`);
        issues++;
      }
    }
  });

  if (issues === 0) console.log("✅ No integrity issues found.");
  else console.warn(`⚠️ Found ${issues} integrity issues.`);
  console.groupEnd();
};