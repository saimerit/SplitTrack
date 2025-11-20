import { useState } from 'react';
import useAppStore from '../store/useAppStore';
import { doc, updateDoc, writeBatch, collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import { exportToCSV } from '../services/exportImportService';

const Settings = () => {
  const { 
    userSettings, categories, places, tags, modesOfPayment, 
    setUserSettings, showToast, participantsLookup, transactions
  } = useAppStore();
  const { user } = useAuth();
  
  const [defaults, setDefaults] = useState({
    defaultCategory: userSettings.defaultCategory || '',
    defaultPlace: userSettings.defaultPlace || '',
    defaultTag: userSettings.defaultTag || '',
    defaultMode: userSettings.defaultMode || ''
  });

  const [newMember, setNewMember] = useState('');

  const handleSaveDefaults = async (e) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'ledgers/main-ledger'), defaults);
      setUserSettings({ ...userSettings, ...defaults });
      showToast("Default settings saved.");
    } catch {
      // Removed unused error var
      showToast("Failed to save settings.", true);
    }
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
    } catch {
       // Removed unused error var
      showToast("Failed to add member.", true);
    }
  };

  const handleRemoveMember = async (email) => {
    if (!window.confirm(`Remove ${email}?`)) return;
    try {
      const newMembers = (userSettings.allowed_emails || []).filter(e => e !== email);
      await updateDoc(doc(db, 'ledgers/main-ledger'), { allowed_emails: newMembers });
      showToast("Member removed.");
    } catch {
       // Removed unused error var
      showToast("Failed to remove member.", true);
    }
  };

  const handleNuclearOption = async () => {
    if (!window.confirm("WARNING: This will DELETE ALL TRANSACTIONS permanently. Are you sure?")) return;
    if (!window.confirm("Really? This cannot be undone.")) return;

    try {
      const batch = writeBatch(db);
      const snap = await getDocs(collection(db, 'ledgers/main-ledger/transactions'));
      snap.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast("All transactions deleted.");
    } catch {
       // Removed unused error var
      showToast("Failed to delete data.", true);
    }
  };

  const mapOpts = (items) => [{ value: '', label: '-- None --' }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <div className="space-y-8">
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Manage Members</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Users who can access this ledger.</p>
        
        <div className="space-y-2 mb-6">
          {(userSettings.allowed_emails || []).map(email => (
            <div key={email} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
              <span className="text-gray-700 dark:text-gray-300">{email} {email === user.email && '(You)'}</span>
              {email !== user.email && (
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Export Data</h3>
            <Button onClick={() => exportToCSV(transactions, participantsLookup)} variant="secondary" className="w-full">Download CSV</Button>
        </div>
        
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-red-200 dark:border-red-900">
            <h3 className="text-xl font-bold text-red-600 mb-4">Danger Zone</h3>
            <p className="text-sm text-gray-500 mb-4">Permanently delete all transaction history.</p>
            <Button onClick={handleNuclearOption} variant="danger" className="w-full">Delete All Transactions</Button>
        </div>
      </div>
    </div>
  );
};

export default Settings;