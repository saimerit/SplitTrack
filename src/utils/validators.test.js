import { describe, it, expect } from 'vitest';
import { validateSplits } from './validators';

describe('validateSplits', () => {
  it('should always return valid for equal split method', () => {
    const result = validateSplits(1000, {}, 'equal');
    expect(result.isValid).toBe(true);
  });

  it('should validate percentage splits correctly', () => {
    // Total 100%
    const validSplits = { 'user1': 50, 'user2': 50 };
    expect(validateSplits(1000, validSplits, 'percentage').isValid).toBe(true);

    // Total 90% (Invalid)
    const invalidSplits = { 'user1': 40, 'user2': 50 };
    const result = validateSplits(1000, invalidSplits, 'percentage');
    expect(result.isValid).toBe(false);
    expect(result.message).toContain('Total is 90%');
  });

  it('should validate dynamic splits matches total amount (in paise)', () => {
    const totalAmount = 10000; // 100 Rupees
    
    // Exact match
    const validSplits = { 'user1': 4000, 'user2': 6000 };
    expect(validateSplits(totalAmount, validSplits, 'dynamic').isValid).toBe(true);

    // Under allocation
    const underSplits = { 'user1': 4000, 'user2': 5000 }; // Total 9000
    const underResult = validateSplits(totalAmount, underSplits, 'dynamic');
    expect(underResult.isValid).toBe(false);
    expect(underResult.message).toContain('remaining');

    // Over allocation
    const overSplits = { 'user1': 6000, 'user2': 5000 }; // Total 11000
    const overResult = validateSplits(totalAmount, overSplits, 'dynamic');
    expect(overResult.isValid).toBe(false);
    expect(overResult.message).toContain('over');
  });

  it('should handle zero total amount in dynamic split', () => {
    const result = validateSplits(0, {}, 'dynamic');
    expect(result.isValid).toBe(false);
    expect(result.message).toBe('Enter total amount first.');
  });
});