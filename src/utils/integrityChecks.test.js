import { describe, it, expect } from 'vitest';
import { runLedgerIntegrityChecks } from './integrityChecks';

describe('runLedgerIntegrityChecks', () => {
  const mockParticipants = [
    { uniqueId: 'p1', name: 'Person 1' },
    { uniqueId: 'p2', name: 'Person 2' }
  ];

  it('should identify orphan refunds', () => {
    const transactions = [
      { 
        id: 'refund1', 
        isLinkedRefund: true, 
        parentTransactionId: 'missing-parent',
        amount: -100 
      }
    ];

    const result = runLedgerIntegrityChecks(transactions, mockParticipants);
    expect(result.issues).toBe(1);
    expect(result.report[0].message).toContain('Orphan refund found');
  });

  it('should verify netAmount calculation consistency', () => {
    const transactions = [
      { 
        id: 'parent1', 
        type: 'expense', 
        amount: 1000, 
        netAmount: 800, // Incorrect, should be 1000 - 100 = 900
        expenseName: 'Test Exp'
      },
      { 
        id: 'refund1', 
        parentTransactionId: 'parent1', 
        amount: -100 
      }
    ];

    const result = runLedgerIntegrityChecks(transactions, mockParticipants);
    expect(result.issues).toBeGreaterThan(0);
    expect(result.report.some(r => r.message.includes('Net Amount mismatch'))).toBe(true);
  });

  it('should detect unknown participants', () => {
    const transactions = [
      { 
        id: 't1', 
        expenseName: 'Bad User Txn', 
        payer: 'unknown-user', 
        amount: 100 
      }
    ];

    const result = runLedgerIntegrityChecks(transactions, mockParticipants);
    expect(result.issues).toBe(1);
    expect(result.report[0].message).toContain('Unknown payer');
  });

  it('should pass for valid ledger data', () => {
    const transactions = [
      { 
        id: 'parent1', 
        type: 'expense', 
        amount: 1000, 
        netAmount: 900,
        payer: 'me',
        expenseName: 'Valid Exp'
      },
      { 
        id: 'refund1', 
        parentTransactionId: 'parent1', 
        amount: -100,
        payer: 'me'
      }
    ];

    const result = runLedgerIntegrityChecks(transactions, mockParticipants);
    expect(result.issues).toBe(0);
  });
});