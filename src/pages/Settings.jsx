import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { doc, updateDoc, setDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { exportToCSV, exportFullBackup, importFromBackup, importFromCSV, nukeCollection } from '../services/exportImportService';

const Settings = () => {
  const { 
    userSettings, categories, places, tags, modesOfPayment, 
    setUserSettings, showToast, participantsLookup, transactions, participants
  } = useAppStore();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [defaults, setDefaults] = useState({
    defaultCategory: userSettings.defaultCategory || '',
    defaultPlace: userSettings.defaultPlace || '',
    defaultTag: userSettings.defaultTag || '',
    defaultMode: userSettings.defaultMode || ''
  });
  
  const [csvFile, setCsvFile] = useState(null);

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
    if (!window.confirm(`Remove ${email}?`)) return;
    try {
      const newMembers = (userSettings.allowed_emails || []).filter(e => e !== email);
      await updateDoc(doc(db, 'ledgers/main-ledger'), { allowed_emails: newMembers });
      showToast("Member removed.");
    } catch { showToast("Failed to remove member.", true); }
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
    
    if (!window.confirm("WARNING: This will DELETE ALL current data and replace it. Continue?")) return;
    
    setLoading(true);
    try {
      const settings = await importFromBackup(file);
      await setDoc(doc(db, 'ledgers/main-ledger'), settings, { merge: true });
      showToast("Full backup restored! Reloading...");
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { console.error(e); showToast("Import failed: " + e.message, true); }
    setLoading(false);
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
    if (!window.confirm(`PERMANENTLY DELETE ALL ${collectionName.toUpperCase()}?`)) return;
    setLoading(true);
    try {
      await nukeCollection(collectionName);
      showToast(`All ${collectionName} deleted.`);
    } catch { showToast("Delete failed.", true); }
    setLoading(false);
  };

  const mapOpts = (items) => [{ value: '', label: '-- None --' }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
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
        </div>
      </div>
    </div>
  );
};

export default Settings;