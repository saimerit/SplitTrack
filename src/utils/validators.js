import { formatCurrency } from './formatters';

export const validateSplits = (totalAmount, splits, method) => {
  if (method === 'equal') return { isValid: true, message: '' };
  
  // totalAmount is expected in Paise
  const total = Math.round(totalAmount);
  
  if (method === 'percentage') {
    const totalPercent = Object.values(splits).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    if (Math.abs(totalPercent - 100) < 0.01) {
      return { isValid: true, message: '✓ Total is 100%' };
    }
    return { isValid: false, message: `Total is ${totalPercent}%. Must be 100%.` };
  }

  if (method === 'dynamic') {
    if (total === 0) return { isValid: false, message: 'Enter total amount first.' };
    
    const splitSum = Object.values(splits).reduce((sum, val) => sum + Math.round(val), 0);
    const diff = total - splitSum;

    if (diff === 0) {
      return { isValid: true, message: `✓ Total matches ${formatCurrency(total)}` };
    } else if (diff > 0) {
      return { isValid: false, message: `${formatCurrency(diff)} remaining.` };
    } else {
      return { isValid: false, message: `${formatCurrency(Math.abs(diff))} over.` };
    }
  }

  return { isValid: true, message: '' };
};