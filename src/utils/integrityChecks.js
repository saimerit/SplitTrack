export const runLedgerIntegrityChecks = (transactions, participants) => {
  const report = [];
  let issues = 0;

  const log = (msg, type = 'warning') => {
    report.push({ type, message: msg });
    if (type === 'warning' || type === 'error') issues++;
  };

  // Create a fast lookup set for valid IDs
  const participantIds = new Set(participants.map(p => p.uniqueId));
  participantIds.add('me');

  // --- 1. Parent–Child Relationships (Existing) ---
  transactions.filter(t => t.isLinkedRefund).forEach(refund => {
    if (refund.parentTransactionId) {
        const parent = transactions.find(p => p.id === refund.parentTransactionId);
        if (!parent) {
          log(`Orphan refund found: ID ${refund.id} links to missing parent ${refund.parentTransactionId}`, 'error');
        }
    }
    if (refund.parentTransactionIds && Array.isArray(refund.parentTransactionIds)) {
        refund.parentTransactionIds.forEach(pid => {
            const parent = transactions.find(p => p.id === pid);
            if (!parent) {
                log(`Orphan refund link found: Refund ${refund.id} links to missing parent ${pid}`, 'error');
            }
        });
    }
  });

  // --- 2. Net Amount Consistency (Existing) ---
  transactions.filter(t => !t.isLinkedRefund && !t.isReturn && t.type === 'expense').forEach(parent => {
    const children = transactions.filter(r => {
        if (r.isReturn || r.type === 'income' || r.amount >= 0) return false;
        if (r.parentTransactionId === parent.id) return true;
        if (r.parentTransactionIds && Array.isArray(r.parentTransactionIds) && r.parentTransactionIds.includes(parent.id)) return true;
        return false;
    });

    const totalRefunds = children.reduce((sum, r) => {
        let allocated = 0;
        if (r.linkedTransactions && Array.isArray(r.linkedTransactions) && r.linkedTransactions.length > 0) {
            const link = r.linkedTransactions.find(l => l.id === parent.id);
            allocated = link ? link.amount : r.amount;
        } else {
            allocated = r.amount;
        }
        return sum + allocated;
    }, 0);

    const expectedNet = parent.amount + totalRefunds;
    if (parent.netAmount !== undefined && Math.abs(parent.netAmount - expectedNet) > 1) {
      log(`Net Amount mismatch for "${parent.expenseName}". Stored: ${parent.netAmount}, Calc: ${expectedNet}`);
    }
  });

  // --- 3. Validate Participants Reference (Enhanced) ---
  transactions.forEach(t => {
    // Check Payer
    if (t.payer !== 'me' && !participantIds.has(t.payer)) {
      log(`Txn "${t.expenseName}": Unknown payer ID '${t.payer}'`, 'error');
    }
    
    // Check 'participants' array if it exists
    if (t.participants && Array.isArray(t.participants)) {
      t.participants.forEach(pId => {
        if (pId !== 'me' && !participantIds.has(pId)) {
          log(`Txn "${t.expenseName}": Unknown participant in array '${pId}'`, 'error');
        }
      });
    }

    // NEW: Check keys inside 'splits' object
    if (t.splits) {
      Object.keys(t.splits).forEach(splitUid => {
        if (splitUid !== 'me' && !participantIds.has(splitUid)) {
          log(`Txn "${t.expenseName}": Split contains unknown user ID '${splitUid}'`, 'error');
        }
      });
    }
  });

  // --- 4. Validate Amount & Splits Math (Existing) ---
  transactions.forEach(t => {
    if (!t.isReturn && t.type !== 'income' && t.splits && Object.keys(t.splits).length > 0) {
      const totalSplit = Object.values(t.splits).reduce((a, b) => a + b, 0);
      // Tolerance of 1 unit (e.g. 1 cent/paise)
      if (Math.abs(Math.abs(totalSplit) - Math.abs(t.amount)) > 1) {
        log(`Split mismatch in "${t.expenseName}". Total: ${t.amount}, Split Sum: ${totalSplit}`, 'error');
      }
    }
  });

  // --- 5. NEW: Basic Data Validity Checks ---
  transactions.forEach(t => {
    // Check Amount is a valid number
    if (typeof t.amount !== 'number' || isNaN(t.amount)) {
      log(`Txn "${t.expenseName || 'Unknown'}": Invalid amount detected (${t.amount})`, 'error');
    }
    
    // Check for Zero Amount (Warning only)
    if (t.amount === 0) {
      log(`Txn "${t.expenseName}": Amount is 0. Is this intended?`, 'warning');
    }

    // Check Timestamp Validity
    const timeVal = t.timestamp?.toMillis ? t.timestamp.toMillis() : new Date(t.timestamp).getTime();
    if (isNaN(timeVal)) {
      log(`Txn "${t.expenseName}": Invalid timestamp`, 'error');
    }

    // Check allowed types
    const allowedTypes = ['expense', 'income', 'refund'];
    if (!allowedTypes.includes(t.type)) {
      log(`Txn "${t.expenseName}": Invalid transaction type '${t.type}'`, 'error');
    }
  });

  // --- 6. NEW: Settlement Logic Integrity ---
  transactions.filter(t => t.isReturn).forEach(t => {
    // Settlements should strictly be between Payer and ONE Recipient
    if (!t.participants || t.participants.length === 0) {
      log(`Settlement "${t.expenseName}": Missing recipient (participants array empty)`, 'error');
    } else if (t.participants.length > 1) {
      log(`Settlement "${t.expenseName}": Has multiple recipients, which is invalid for a 1-on-1 settlement`, 'warning');
    }

    // Circular check: Payer cannot settle with themselves
    if (t.participants && t.participants[0] === t.payer) {
      log(`Settlement "${t.expenseName}": Payer and Recipient are the same person`, 'error');
    }
  });

  return { issues, report };
};