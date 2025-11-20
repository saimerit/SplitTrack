export const formatCurrency = (amountInPaise) => {
  const amountInRupees = (amountInPaise || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amountInRupees);
};

export const formatDate = (timestamp) => {
  if (!timestamp) return 'Invalid date';
  // Handle both Firestore Timestamp and standard Date objects
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export const toISODateString = (date) => {
  const d = date instanceof Date ? date : date.toDate();
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const normalize = (str) => String(str || "").trim().toLowerCase();