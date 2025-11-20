import { formatDate } from '../utils/formatters';

// Helper to escape CSV strings
const escapeCSV = (str) => {
  if (str === null || str === undefined) return '';
  return str.toString().replace(/"/g, '""');
};

export const exportToCSV = (transactions, participantsLookup) => {
  if (!transactions || transactions.length === 0) {
    alert("No transactions to export.");
    return;
  }

  const headers = [
    "ID", "Date", "Name", "Amount (Rupees)", "Payer", "Category", 
    "Place", "Tag", "Mode of Payment", "Description", "Is Repayment?", 
    "Participants (IDs)", "Splits (JSON)" 
  ];

  let csvContent = headers.join(",") + "\n";

  transactions.forEach(txn => {
    const splits = txn.splits || {};
    let splitsJsonString = "";
    
    if (!txn.isReturn && Object.keys(splits).length > 0) {
      splitsJsonString = JSON.stringify(splits).replace(/"/g, '""');
    }
    
    splitsJsonString = `"${splitsJsonString}"`; 
    
    const payerName = participantsLookup.get(txn.payer)?.name || txn.payer;

    const row = [
      `"${escapeCSV(txn.id)}"`,
      `"${formatDate(txn.timestamp)}"`,
      `"${escapeCSV(txn.expenseName)}"`,
      (txn.amount / 100).toFixed(2),
      `"${escapeCSV(payerName)}"`,
      `"${escapeCSV(txn.category || '')}"`,
      `"${escapeCSV(txn.place || '')}"`,
      `"${escapeCSV(txn.tag || '')}"`,
      `"${escapeCSV(txn.modeOfPayment || '')}"`,
      `"${escapeCSV(txn.description || '')}"`,
      txn.isReturn,
      `"${escapeCSV((txn.participants || []).join(', '))}"`,
      splitsJsonString
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `splittrack_export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};