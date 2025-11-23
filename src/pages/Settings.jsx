import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { doc, updateDoc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { LogOut, Moon, Sun, Download } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { exportToCSV, exportFullBackup, importFromBackup, importFromCSV, nukeCollection, downloadCSVTemplate } from '../services/exportImportService';
import ConfirmModal from '../components/modals/ConfirmModal';

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

  // --- Sign Out Logic ---
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
    setModalConfig({
      isOpen: true,
      title: `Delete All ${collectionName}?`,
      message: `Permanently delete <strong>ALL</strong> ${collectionName}? This cannot be undone.`,
      confirmInput: "DELETE",
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

  const mapOpts = (items) => [{ value: '', label: '-- None --' }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
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
                
                {/* Visual Slider (Toggle Switch) */}
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