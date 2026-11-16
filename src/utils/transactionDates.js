const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const toDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const transactionDateKey = (transaction) => {
  if (DATE_KEY.test(transaction?.dateString || '')) return transaction.dateString;
  const timestamp = transaction?.timestamp;
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return toDateKey(date);
};

// A calendar date is stored separately from the instant. Noon UTC prevents a
// date-only input from being interpreted as the previous day in western zones.
export const dateKeyToStorageDate = (dateKey) => {
  if (!DATE_KEY.test(dateKey || '')) return null;
  return new Date(`${dateKey}T12:00:00.000Z`);
};

export const formatDateKey = (dateKey, options = {}) => {
  const date = dateKeyToStorageDate(dateKey);
  if (!date) return 'Invalid date';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...options
  }).format(date);
};

export const dateKeyParts = (dateKey) => {
  if (!DATE_KEY.test(dateKey || '')) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month: month - 1, day };
};
