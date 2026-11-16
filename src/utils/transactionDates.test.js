import { describe, expect, it } from 'vitest';
import { dateKeyParts, dateKeyToStorageDate, formatDateKey, transactionDateKey } from './transactionDates';

describe('transaction calendar dates', () => {
  it('uses the persisted calendar date instead of converting it through the viewer timezone', () => {
    expect(transactionDateKey({ dateString: '2026-03-31', timestamp: new Date('2026-04-01T00:30:00Z') })).toBe('2026-03-31');
    expect(dateKeyParts('2026-03-31')).toEqual({ year: 2026, month: 2, day: 31 });
  });

  it('creates a stable date-only storage instant and label', () => {
    expect(dateKeyToStorageDate('2026-01-01').toISOString()).toBe('2026-01-01T12:00:00.000Z');
    expect(formatDateKey('2026-01-01')).toBe('Jan 1, 2026');
  });
});
