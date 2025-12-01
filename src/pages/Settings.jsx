// src/pages/Settings.jsx
import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { doc, updateDoc, setDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { LogOut, Moon, Sun, ShieldCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { exportToCSV, exportFullBackup, importFromBackup, importFromCSV, nukeCollection, downloadCSVTemplate } from '../services/exportImportService';
import ConfirmModal from '../components/modals/ConfirmModal';
import { restoreTransaction, permanentDeleteTransaction } from '../services/transactionService';
import { formatCurrency } from '../utils/formatters';
import { runLedgerIntegrityChecks } from '../utils/integrityChecks';

const Settings = () => {
  const { 
    userSettings, categories, places, tags, modesOfPayment, 
    setUserSettings, showToast, participantsLookup, transactions, participants
  } = useAppStore();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme(); 
  
  const [loading, setLoading] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [defaults, setDefaults] = useState({
    defaultCategory: userSettings.defaultCategory || '',
    defaultPlace: userSettings.defaultPlace || '',
    defaultTag: userSettings.defaultTag || '',
    defaultMode: userSettings.defaultMode || ''
  });
  
  const [csvFile, setCsvFile] = useState(null);
  const [trashItems, setTrashItems] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  
  const [healthReport, setHealthReport] = useState(null);

  // Modal State
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmInput: '',
    confirmText: 'Confirm',
    onConfirm: () => {}
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));

  const handleRunIntegrityCheck = () => {
    setLoading(true);
    setTimeout(() => {
        const result = runLedgerIntegrityChecks(transactions, participants);
        setHealthReport(result);
        setLoading(false);
        if (result.issues === 0) showToast("System is healthy!");
        else showToast(`Found ${result.issues} issues.`, true);
    }, 500);
  };

  const handleSignOutRequest = () => {
    setModalConfig({
      isOpen: true,
      title: "Sign Out?",
      message: "Are you sure you want to sign out of SplitTrack?",
      confirmText: "Sign Out",
      onConfirm: () => {
        logout();
        closeModal();
      }
    });
  };

  const handleSaveDefaults = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'ledgers/main-ledger'), defaults);
      setUserSettings({ ...userSettings, ...defaults });
      showToast("Default settings saved.");
    } catch { showToast("Failed to save settings.", true); }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMember.trim()) return;
    const currentMembers = userSettings.allowed_emails || [];
    if (currentMembers.includes(newMember)) {
        showToast("User already exists.", true);
        return;
    }
    try {
      const newMembers = [...currentMembers, newMember];
      await updateDoc(doc(db, 'ledgers/main-ledger'), { allowed_emails: newMembers });
      setNewMember('');
      showToast("Member added.");
    } catch { showToast("Failed to add member.", true); }
  };

  const handleRemoveMember = async (email) => {
    setModalConfig({
      isOpen: true,
      title: "Remove Member?",
      message: `Remove <strong>${email}</strong>? They will lose access immediately.`,
      confirmInput: "REMOVE",
      confirmText: "Remove",
      onConfirm: async () => {
        try {
          const newMembers = (userSettings.allowed_emails || []).filter(e => e !== email);
          await updateDoc(doc(db, 'ledgers/main-ledger'), { allowed_emails: newMembers });
          showToast("Member removed.");
        } catch { showToast("Failed to remove member.", true); }
        closeModal();
      }
    });
  };

  const handleExportJSON = async () => {
    setLoading(true);
    try {
      await exportFullBackup(userSettings);
      showToast("Backup exported successfully!");
    } catch (e) { console.error(e); showToast("Export failed.", true); }
    setLoading(false);
  };

  const handleImportJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setModalConfig({
      isOpen: true,
      title: "Restore from Backup?",
      message: "This will <strong class='text-red-500'>DELETE ALL</strong> current data and replace it with the data from this backup. This cannot be undone.",
      confirmInput: "DELETE ALL",
      confirmText: "Restore",
      onConfirm: async () => {
        setLoading(true);
        try {
          const settings = await importFromBackup(file);
          await setDoc(doc(db, 'ledgers/main-ledger'), settings, { merge: true });
          showToast("Full backup restored! Reloading...");
          setTimeout(() => window.location.reload(), 1500);
        } catch (e) { console.error(e); showToast("Import failed: " + e.message, true); }
        setLoading(false);
        closeModal();
      }
    });
  };

  const handleCSVImport = async () => {
    if (!csvFile) return;
    setLoading(true);
    try {
      const { txnsToAdd, newMeta } = await importFromCSV(csvFile, participants);
      
      const batch = writeBatch(db);
      const addIfNew = (set, existingArr, colName) => {
        set.forEach(name => {
           if (!existingArr.find(i => i.name === name)) {
             const ref = doc(collection(db, `ledgers/main-ledger/${colName}`));
             batch.set(ref, { name });
           }
        });
      };
      addIfNew(newMeta.categories, categories, 'categories');
      addIfNew(newMeta.places, places, 'places');
      addIfNew(newMeta.tags, tags, 'tags');
      addIfNew(newMeta.modes, modesOfPayment, 'modesOfPayment');
      await batch.commit(); 

      const BATCH_SIZE = 400;
      for (let i = 0; i < txnsToAdd.length; i += BATCH_SIZE) {
        const txnBatch = writeBatch(db);
        txnsToAdd.slice(i, i + BATCH_SIZE).forEach(txn => {
          const ref = doc(collection(db, 'ledgers/main-ledger/transactions'));
          txnBatch.set(ref, txn);
        });
        await txnBatch.commit();
      }

      showToast(`Imported ${txnsToAdd.length} transactions!`);
      setCsvFile(null);
    } catch (e) { console.error(e); showToast("CSV Import Error: " + e.message, true); }
    setLoading(false);
  };

  const handleNuke = async (collectionName) => {
    // UPDATED: Dynamically set the confirmation keyword (e.g., "DELETE TRANSACTIONS")
    const confirmKeyword = `DELETE ${collectionName.toUpperCase()}`;
    
    setModalConfig({
      isOpen: true,
      title: `Delete All ${collectionName}?`,
      message: `Permanently delete <strong>ALL</strong> ${collectionName}? This cannot be undone.`,
      confirmInput: confirmKeyword, 
      confirmText: "Delete All",
      onConfirm: async () => {
        setLoading(true);
        try {
          await nukeCollection(collectionName);
          showToast(`All ${collectionName} deleted.`);
        } catch { showToast("Delete failed.", true); }
        setLoading(false);
        closeModal();
      }
    });
  };

  const fetchTrash = async () => {
    const q = query(collection(db, 'ledgers/main-ledger/transactions'), where('isDeleted', '==', true));
    const snap = await getDocs(q);
    setTrashItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setShowTrash(true);
  };

  const handleRestore = async (id) => {
      await restoreTransaction(id);
      setTrashItems(prev => prev.filter(t => t.id !== id));
      showToast("Restored transaction.");
  };

  const handleHardDelete = async (id) => {
      setModalConfig({
        isOpen: true,
        title: "Permanently Delete?",
        message: "Are you sure you want to permanently delete this item? This cannot be undone.",
        confirmText: "Delete Forever",
        onConfirm: async () => {
            await permanentDeleteTransaction(id);
            setTrashItems(prev => prev.filter(t => t.id !== id));
            showToast("Permanently deleted.");
            closeModal();
        }
      });
  };

  const mapOpts = (items) => [{ value: '', label: '-- None --' }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in">
      
      {/* App Preferences Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">App Preferences</h3>
        <div className="flex flex-col sm:flex-row gap-4">
            <Button 
              onClick={toggleTheme} 
              variant="secondary" 
              className="flex items-center justify-between gap-4 flex-1 py-3 group"
            >
                <div className="flex items-center gap-2">
                    {theme === 'dark' ? <Moon size={18}/> : <Sun size={18}/>}
                    <span>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
                </div>
                
                <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out ${theme === 'dark' ? 'bg-sky-600' : 'bg-gray-300'}`}>
                    <span 
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`} 
                    />
                </div>
            </Button>
            
            <Button 
              onClick={handleSignOutRequest} 
              variant="danger" 
              className="flex items-center justify-center gap-2 flex-1 py-3"
            >
                <LogOut size={18}/> Sign Out
            </Button>
        </div>
      </div>

      {/* System Health Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
          <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                  <ShieldCheck size={20} className="text-emerald-500" /> System Health
              </h3>
              <Button onClick={handleRunIntegrityCheck} disabled={loading} variant="secondary" className="text-sm">
                  {loading ? "Checking..." : "Run Diagnostics"}
              </Button>
          </div>
          
          {!healthReport ? (
              <p className="text-sm text-gray-500">Run diagnostics to check for orphan refunds, missing participants, or calculation errors.</p>
          ) : (
              <div className="space-y-3">
                  <div className={`p-3 rounded-lg border flex items-center gap-3 ${healthReport.issues === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                      {healthReport.issues === 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                      <span className="font-medium">
                          {healthReport.issues === 0 ? "System healthy. No issues found." : `Found ${healthReport.issues} potential issue(s).`}
                      </span>
                  </div>
                  
                  {healthReport.report.length > 0 && (
                      <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                          {healthReport.report.map((log, idx) => (
                              <div key={idx} className="text-xs font-mono py-1 border-b last:border-0 border-gray-200 dark:border-gray-700 dark:text-gray-300">
                                  <span className={`font-bold ${log.type === 'error' ? 'text-red-500' : 'text-yellow-600'}`}>[{log.type.toUpperCase()}]</span> {log.message}
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          )}
      </div>

      {/* Feature 8: Trash Zone */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Recycle Bin</h3>
          {!showTrash ? (
              <Button onClick={fetchTrash} variant="secondary">View Deleted Items</Button>
          ) : (
              <div className="space-y-2">
                  {trashItems.length === 0 ? <p className="text-gray-500">Trash is empty.</p> : 
                    trashItems.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900">
                            <div>
                                <p className="font-medium dark:text-gray-200">{item.expenseName}</p>
                                <p className="text-xs text-gray-500">{formatCurrency(item.amount)}</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleRestore(item.id)} className="text-green-600 hover:underline text-sm">Restore</button>
                                <button onClick={() => handleHardDelete(item.id)} className="text-red-600 hover:underline text-sm">Delete Forever</button>
                            </div>
                        </div>
                    ))
                  }
                  <Button onClick={() => setShowTrash(false)} variant="ghost" className="mt-4">Hide Trash</Button>
              </div>
          )}
      </div>

      {/* Manage Members Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Manage Members</h3>
        <div className="space-y-2 mb-6">
          {(userSettings.allowed_emails || []).map(email => (
            <div key={email} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
              <span className="text-gray-700 dark:text-gray-300">{email} {email === user?.email && '(You)'}</span>
              {email !== user?.email && (
                <button onClick={() => handleRemoveMember(email)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleAddMember} className="flex gap-2">
          <Input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="user@email.com" className="flex-1" />
          <Button type="submit">Add</Button>
        </form>
      </div>

      {/* Default Values Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Default Values</h3>
        <form onSubmit={handleSaveDefaults} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select label="Default Category" value={defaults.defaultCategory} onChange={e => setDefaults({...defaults, defaultCategory: e.target.value})} options={mapOpts(categories)} />
            <Select label="Default Place" value={defaults.defaultPlace} onChange={e => setDefaults({...defaults, defaultPlace: e.target.value})} options={mapOpts(places)} />
            <Select label="Default Tag" value={defaults.defaultTag} onChange={e => setDefaults({...defaults, defaultTag: e.target.value})} options={mapOpts(tags)} />
            <Select label="Default Mode" value={defaults.defaultMode} onChange={e => setDefaults({...defaults, defaultMode: e.target.value})} options={mapOpts(modesOfPayment)} />
            <div className="md:col-span-2">
                <Button type="submit" className="w-full">Save Defaults</Button>
            </div>
        </form>
      </div>

      {/* CSV and Backup Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">CSV Data</h3>
            <div className="space-y-4">
              <Button onClick={() => exportToCSV(transactions, participantsLookup)} variant="secondary" className="w-full">
                Download Transactions CSV
              </Button>
              <hr className="dark:border-gray-700"/>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Import CSV (Legacy or Backup)</p>
                <button onClick={downloadCSVTemplate} className="text-xs text-sky-600 hover:underline mb-3 block">
                  Download CSV Import Template
                </button>
                <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 dark:file:bg-gray-700 dark:file:text-gray-200"/>
                <Button onClick={handleCSVImport} disabled={!csvFile || loading} className="w-full mt-2">
                  {loading ? 'Importing...' : 'Import Transactions'}
                </Button>
              </div>
            </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Full Backup (JSON)</h3>
            <div className="space-y-4">
              <Button onClick={handleExportJSON} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700">
                {loading ? 'Exporting...' : 'Export Full Backup'}
              </Button>
              <hr className="dark:border-gray-700"/>
              <div>
                 <p className="text-sm text-red-500 mb-2 font-medium">Restore (Wipes existing data!)</p>
                 <input type="file" accept=".json" onChange={handleImportJSON} disabled={loading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 dark:file:bg-gray-700 dark:file:text-red-300"/>
              </div>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-red-200 dark:border-red-900">
        <h3 className="text-xl font-bold text-red-600 mb-6">Danger Zone</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           <Button onClick={() => handleNuke('transactions')} variant="danger">Delete All Transactions</Button>
           <Button onClick={() => handleNuke('participants')} variant="danger">Delete All Participants</Button>
           <Button onClick={() => handleNuke('categories')} variant="danger">Delete All Categories</Button>
           <Button onClick={() => handleNuke('places')} variant="danger">Delete All Places</Button>
           <Button onClick={() => handleNuke('tags')} variant="danger">Delete All Tags</Button>
           <Button onClick={() => handleNuke('modesOfPayment')} variant="danger">Delete All Modes</Button>
        </div>
      </div>

      <ConfirmModal 
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        confirmInputRequired={modalConfig.confirmInput}
        confirmText={modalConfig.confirmText}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />
    </div>
  );
};

export default Settings;