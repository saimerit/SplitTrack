import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SplitAllocator from './SplitAllocator';

describe('SplitAllocator Component', () => {
  const mockParticipants = [
    { uniqueId: 'p1', name: 'Alice' },
    { uniqueId: 'p2', name: 'Bob' },
    { uniqueId: 'p3', name: 'Charlie' }
  ];
  
  const totalAmountPaise = 30000; // 300.00 Rupees

  it('renders equal split message correctly', () => {
    render(
      <SplitAllocator 
        method="equal" 
        participants={mockParticipants} 
        totalAmount={totalAmountPaise}
        splits={{}}
        onSplitChange={() => {}}
      />
    );
    expect(screen.getByText(/Splitting equally among 3 person\(s\)/i)).toBeInTheDocument();
  });

  it('handles dynamic split changes and redistribution', () => {
    const onSplitChange = vi.fn();
    const initialSplits = { 'p1': 10000, 'p2': 10000, 'p3': 10000 };

    render(
      <SplitAllocator 
        method="dynamic" 
        participants={mockParticipants} 
        totalAmount={totalAmountPaise}
        splits={initialSplits}
        onSplitChange={onSplitChange}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(3);

    // Simulate changing Alice's share to 100.00
    // Note: Component logic distributes remainder to unlocked fields
    fireEvent.change(inputs[0], { target: { value: '200' } }); // Alice takes 200

    expect(onSplitChange).toHaveBeenCalled();
    
    // We check the logic called. 
    // Total 300. Alice 200. Remaining 100 split between Bob and Charlie (50 each).
    // Expect splits to be: p1: 20000, p2: 5000, p3: 5000
    const lastCallArg = onSplitChange.mock.calls[onSplitChange.mock.calls.length - 1][0];
    expect(lastCallArg['p1']).toBe(20000);
    expect(lastCallArg['p2']).toBe(5000);
    expect(lastCallArg['p3']).toBe(5000);
  });

  it('handles percentage split updates', () => {
    const onSplitChange = vi.fn();
    render(
      <SplitAllocator 
        method="percentage" 
        participants={mockParticipants} 
        totalAmount={totalAmountPaise}
        splits={{ 'p1': 33.33, 'p2': 33.33, 'p3': 33.34 }}
        onSplitChange={onSplitChange}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '50' } });

    const lastCallArg = onSplitChange.mock.calls[0][0];
    expect(lastCallArg['p1']).toBe(50);
    // Percentage allocator does NOT redistribute automatically in the provided component code,
    // it just updates the single value.
    expect(lastCallArg['p2']).toBe(33.33); 
  });
});