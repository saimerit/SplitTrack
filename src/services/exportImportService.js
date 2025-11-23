import { 
  collection, getDocs, writeBatch, doc, 
  query, limit, Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import Papa from 'papaparse';
import { formatDate, normalize } from '../utils/formatters';

// --- UTILITIES ---
const escapeCSV = (str) => {
  if (str === null || str === undefined) return '';
  return str.toString().replace(/"/g, '""');
};

const fetchAll = async (colName) => {
  const snap = await getDocs(collection(db, `ledgers/main-ledger/${colName}`));
  return snap.docs.map(d => {
    const data = d.data();
    if (data.timestamp && data.timestamp.toDate) {
      data.timestamp = data.timestamp.toDate().toISOString();
    }
    return { id: d.id, ...data };
  });
};

const deleteAll = async (colName) => {
  const colRef = collection(db, `ledgers/main-ledger/${colName}`);
  const q = query(colRef, limit(400));
  
  const deleteBatch = async () => {
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    await deleteBatch();
  };
  
  await deleteBatch();
};

const batchImport = async (colName, items) => {
  if (!items || items.length === 0) return;
  const colRef = collection(db, `ledgers/main-ledger/${colName}`);
  
  const BATCH_SIZE = 400;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = items.slice(i, i + BATCH_SIZE);
    
    chunk.forEach(item => {
      const docId = item.id; 
      const data = { ...item };
      if (data.id) delete data.id; 
      
      if (data.timestamp && typeof data.timestamp === 'string') {
        data.timestamp = Timestamp.fromDate(new Date(data.timestamp));
      }
      
      const docRef = docId ? doc(colRef, docId) : doc(colRef);
      batch.set(docRef, data);
    });
    await batch.commit();
  }
};

const downloadFile = (content, fileName, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- EXPORT FEATURES ---

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
    
    const payerName = txn.payer === 'me' ? 'You (me)' : (participantsLookup.get(txn.payer)?.name || txn.payer);

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
      `"${splitsJsonString}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  downloadFile(csvContent, `splittrack_export_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
};

export const exportFullBackup = async (userSettings) => {
  const collections = ['participants', 'categories', 'places', 'tags', 'modesOfPayment', 'transactions', 'templates', 'goals'];
  const backupData = {
    exportVersion: 2.0,
    exportDate: new Date().toISOString(),
    settings: userSettings || {},
  };

  await Promise.all(collections.map(async (col) => {
    backupData[col] = await fetchAll(col);
  }));

  const jsonString = JSON.stringify(backupData, null, 2);
  downloadFile(jsonString, `splittrack_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
};

// --- IMPORT FEATURES ---

export const importFromBackup = async (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.exportVersion || !data.transactions) throw new Error("Invalid backup format");

        const collections = ['participants', 'categories', 'places', 'tags', 'modesOfPayment', 'transactions', 'templates', 'goals'];
        await Promise.all(collections.map(col => deleteAll(col)));
        await Promise.all(collections.map(col => batchImport(col, data[col])));
        
        resolve(data.settings);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsText(file);
  });
};

export const importFromCSV = (file, allParticipants) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const processed = processCSVRows(results.data, allParticipants);
          resolve(processed);
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err)
    });
  });
};

const processCSVRows = (rows, allParticipants) => {
  const txnsToAdd = [];
  const participantMap = new Map();
  allParticipants.forEach(p => participantMap.set(normalize(p.name), p.uniqueId));
  participantMap.set(normalize("You (me)"), "me");

  const newMeta = { categories: new Set(), places: new Set(), tags: new Set(), modes: new Set() };

  rows.forEach((row, index) => {
    if (!row.Name || !row['Amount (Rupees)']) return; 

    const payerId = participantMap.get(normalize(row.Payer?.trim()));
    if (!payerId) throw new Error(`Row ${index + 1}: Payer "${row.Payer}" not found in participants.`);

    const partIds = row['Participants (IDs)']?.split(',').map(s => s.trim()).filter(Boolean) || [];
    const isReturn = row['Is Repayment?']?.trim().toUpperCase() === 'TRUE';
    
    const amountPaise = Math.round(parseFloat(row['Amount (Rupees)']) * 100);
    
    // --- DATE FIX ---
    const date = new Date(row.Date);
    if (isNaN(date.getTime())) {
        console.warn(`Skipping row ${index + 1}: Invalid date "${row.Date}"`);
        return; // Skip this row
    }
    date.setHours(12, 0, 0, 0);

    if (row.Category) newMeta.categories.add(row.Category.trim());
    if (row.Place) newMeta.places.add(row.Place.trim());
    if (row.Tag) newMeta.tags.add(row.Tag.trim());
    if (row['Mode of Payment']) newMeta.modes.add(row['Mode of Payment'].trim());

    let splits = {};
    let splitMethod = 'equal';
    const jsonSplit = row['Splits (JSON)'];

    if (!isReturn && jsonSplit) {
      try {
        splits = JSON.parse(jsonSplit);
        splitMethod = 'dynamic';
      } catch {
        console.warn(`Row ${index + 1}: Invalid JSON split, defaulting to equal.`);
      }
    } else if (!isReturn) {
       const share = Math.round(amountPaise / partIds.length);
       let total = 0;
       partIds.forEach((uid, idx) => {
         if (idx === partIds.length - 1) splits[uid] = amountPaise - total;
         else { splits[uid] = share; total += share; }
       });
    }

    txnsToAdd.push({
      expenseName: row.Name.trim(),
      amount: amountPaise,
      description: row.Description || '',
      category: row.Category || '',
      place: row.Place || '',
      tag: row.Tag || '',
      modeOfPayment: row['Mode of Payment'] || '',
      payer: payerId,
      isReturn,
      timestamp: Timestamp.fromDate(date),
      participants: partIds,
      splits,
      splitMethod
    });
  });

  return { txnsToAdd, newMeta };
};

export const nukeCollection = deleteAll;