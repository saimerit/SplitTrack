import React, { useState } from 'react';
import useAppStore, { PALETTE_PRESETS } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import {
  Moon, Sun, Palette, Check, Trash2, Wrench,
  LogOut, ShieldCheck, AlertTriangle, CheckCircle, Database, Download
} from 'lucide-react';
import { doc, updateDoc, setDoc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { exportToCSV, exportFullBackup, importFromBackup, importFromCSV, nukeCollection, downloadCSVTemplate } from '../services/exportImportService';
import { runLedgerIntegrityChecks } from '../utils/integrityChecks';
import { restoreTransaction, permanentDeleteTransaction } from '../services/transactionService';
import { formatCurrency } from '../utils/formatters';

import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import ConfirmModal from '../components/modals/ConfirmModal';

const PalettePreview = ({ colors, name, isActive, onClick, onDelete }) => {
  return (
    <div onClick={onClick} className={`relative group cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${isActive ? 'border-sky-500 scale-105 shadow-lg' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}>
      <div className="h-24 md:h-28 w-full flex flex-col text-[10px]" style={{ backgroundColor: colors.bgMain, color: colors.textMain }}>
        <div className="p-2 flex justify-between items-center border-b" style={{ borderColor: colors.border || 'rgba(0,0,0,0.1)' }}>
          <span className="font-bold opacity-75">9:41</span>
          <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-current"></div></div>
        </div>
        <div className="p-2 flex-1 flex flex-col gap-2">
          <div className="p-2 rounded-lg shadow-sm flex justify-between items-center" style={{ backgroundColor: colors.bgSurface }}>
            <span>Exp.</span><span className="font-bold" style={{ color: colors.primary }}>-$50</span>
          </div>
        </div>
      </div>
      <div className="p-2 bg-white dark:bg-gray-800 text-xs font-medium text-center border-t border-gray-100 dark:border-gray-700 truncate">{name}</div>
      {isActive && <div className="absolute top-2 right-2 bg-sky-500 text-white rounded-full p-1 shadow-sm"><Check size={12} /></div>}
      {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="absolute top-2 left-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"><Trash2 size={12} /></button>}
    </div>
  );
};

const Settings = () => {
  const { userSettings, categories, places, tags, modesOfPayment, setUserSettings, showToast, transactions, participants, participantsLookup, activePaletteId, setActivePalette, customPalettes, addCustomPalette, deleteCustomPalette } = useAppStore();
  const { user, logout } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();

  const [loading, setLoading] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [defaults, setDefaults] = useState({ defaultCategory: userSettings.defaultCategory || '', defaultPlace: userSettings.defaultPlace || '', defaultTag: userSettings.defaultTag || '', defaultMode: userSettings.defaultMode || '' });
  const [showCreator, setShowCreator] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColors, setNewColors] = useState({ bgMain: '#ffffff', bgSurface: '#f3f4f6', primary: '#3b82f6', textMain: '#000000' });
  const [healthReport, setHealthReport] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [trashItems, setTrashItems] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', confirmInput: '', confirmText: 'Confirm', onConfirm: () => { } });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const allPalettes = [...PALETTE_PRESETS, ...customPalettes];

  const handlePaletteSelect = (palette) => {
    setActivePalette(palette.id);
    setTimeout(() => {
      if (palette.id === 'blackout') { if (theme !== 'dark') { setTheme('dark'); showToast('Switched to dark mode.'); } } 
      else if (palette.type && palette.type !== 'custom') { if (palette.type !== theme && palette.id !== 'default') { setTheme(palette.type); showToast(`Switched to ${palette.type} mode.`); } }
    }, 50);
  };
  const handleCreatePalette = (e) => {
    e.preventDefault(); if (!newPaletteName) return;
    const id = `custom_${Date.now()}`;
    addCustomPalette({ id, name: newPaletteName, type: 'custom', colors: { light: newColors, dark: newColors } });
    setActivePalette(id); setShowCreator(false); setNewPaletteName(''); showToast("Palette created!");
  };
  const handleSaveDefaults = async (e) => {
    e.preventDefault(); try { await updateDoc(doc(db, 'ledgers/main-ledger'), defaults); setUserSettings({ ...userSettings, ...defaults }); showToast("Defaults saved."); } catch { showToast("Failed to save.", true); }
  };
  const handleAddMember = async (e) => {
    e.preventDefault(); if (!newMember.trim()) return;
    const current = userSettings.allowed_emails || [];
    if (current.includes(newMember)) { showToast("User exists.", true); return; }
    try { await updateDoc(doc(db, 'ledgers/main-ledger'), { allowed_emails: [...current, newMember] }); setNewMember(''); showToast("Member added."); } catch { showToast("Failed.", true); }
  };
  const handleRemoveMember = async (email) => {
    setModalConfig({ isOpen: true, title: "Remove Member?", message: `Remove <strong>${email}</strong>?`, confirmInput: "REMOVE", confirmText: "Remove", onConfirm: async () => {
        try { const newM = (userSettings.allowed_emails || []).filter(e => e !== email); await updateDoc(doc(db, 'ledgers/main-ledger'), { allowed_emails: newM }); showToast("Removed."); } catch { showToast("Failed.", true); } closeModal();
    }});
  };
  const handleRunIntegrityCheck = () => {
    setLoading(true); setTimeout(() => { const r = runLedgerIntegrityChecks(transactions, participants); setHealthReport(r); setLoading(false); if (r.issues === 0) showToast("Healthy!"); else showToast(`${r.issues} issues.`, true); }, 500);
  };
  
  // --- NEW: Fix Invalid Types Logic ---
  const handleFixInvalidTypes = () => {
    setModalConfig({
        isOpen: true,
        title: "Repair Transaction Types?",
        message: "This will set the type of all invalid transactions (20 detected) to <strong>'expense'</strong>. This is safe for most data.",
        confirmText: "Fix All",
        onConfirm: async () => {
            setLoading(true);
            try {
                const batch = writeBatch(db);
                let count = 0;
                // Identify invalid transactions from local store
                const invalidTxns = transactions.filter(t => !['expense', 'income', 'refund'].includes(t.type));
                
                invalidTxns.forEach(t => {
                    const ref = doc(db, 'ledgers/main-ledger/transactions', t.id);
                    batch.update(ref, { type: 'expense' }); // Default to expense
                    count++;
                });

                if(count > 0) {
                    await batch.commit();
                    showToast(`Repaired ${count} transactions.`);
                    handleRunIntegrityCheck(); // Re-run check to update UI
                } else {
                    showToast("No invalid items found.");
                }
            } catch (e) {
                console.error(e);
                showToast("Repair failed.", true);
            }
            setLoading(false);
            closeModal();
        }
    });
  };

  const fetchTrash = async () => {
    const q = query(collection(db, 'ledgers/main-ledger/transactions'), where('isDeleted', '==', true));
    const s = await getDocs(q); setTrashItems(s.docs.map(d => ({ id: d.id, ...d.data() }))); setShowTrash(true);
  };
  const handleRestore = async (id) => { await restoreTransaction(id); setTrashItems(p => p.filter(t => t.id !== id)); showToast("Restored."); };
  const handleHardDelete = async (id) => {
    setModalConfig({ isOpen: true, title: "Delete Forever?", message: "Undone.", confirmText: "Delete", onConfirm: async () => { await permanentDeleteTransaction(id); setTrashItems(p => p.filter(t => t.id !== id)); closeModal(); }});
  };
  const handleSignOutRequest = () => { setModalConfig({ isOpen: true, title: "Sign Out?", message: "Confirm sign out?", confirmText: "Sign Out", onConfirm: () => { logout(); closeModal(); }}); };
  const handleExportJSON = async () => { setLoading(true); try { await exportFullBackup(userSettings); showToast("Exported!"); } catch { showToast("Failed.", true); } setLoading(false); };
  const handleImportJSON = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    setModalConfig({ isOpen: true, title: "Restore?", message: "Wipes data.", confirmInput: "DELETE ALL", confirmText: "Restore", onConfirm: async () => {
      setLoading(true); try { const s = await importFromBackup(f); await setDoc(doc(db, 'ledgers/main-ledger'), s, { merge: true }); showToast("Restored!"); setTimeout(() => window.location.reload(), 1500); } catch { showToast("Failed.", true); } setLoading(false); closeModal();
    }});
  };
  const handleCSVImport = async () => {
    if (!csvFile) return; setLoading(true);
    try {
      const { txnsToAdd, newMeta } = await importFromCSV(csvFile, participants);
      const batch = writeBatch(db);
      const add = (s, arr, c) => s.forEach(n => { if (!arr.find(i => i.name === n)) batch.set(doc(collection(db, `ledgers/main-ledger/${c}`)), { name: n }); });
      add(newMeta.categories, categories, 'categories'); add(newMeta.places, places, 'places'); add(newMeta.tags, tags, 'tags'); add(newMeta.modes, modesOfPayment, 'modesOfPayment');
      await batch.commit();
      const BATCH_SIZE = 400; for (let i = 0; i < txnsToAdd.length; i += BATCH_SIZE) { const tb = writeBatch(db); txnsToAdd.slice(i, i + BATCH_SIZE).forEach(t => tb.set(doc(collection(db, 'ledgers/main-ledger/transactions')), t)); await tb.commit(); }
      showToast(`Imported ${txnsToAdd.length}!`); setCsvFile(null);
    } catch (e) { showToast("Error: " + e.message, true); } setLoading(false);
  };
  const handleNuke = async (n) => {
    setModalConfig({ isOpen: true, title: `Delete All ${n}?`, message: `Delete ALL ${n}?`, confirmInput: `DELETE ${n.toUpperCase()}`, confirmText: "Delete All", onConfirm: async () => {
      setLoading(true); try { await nukeCollection(n); showToast("Deleted."); } catch { showToast("Failed.", true); } setLoading(false); closeModal();
    }});
  };
  const handleEmptyTrash = async () => {
    setModalConfig({ isOpen: true, title: "Empty Trash?", message: "Delete all?", confirmInput: "EMPTY", confirmText: "Empty", onConfirm: async () => {
      setLoading(true); try { const q = query(collection(db, 'ledgers/main-ledger/transactions'), where('isDeleted', '==', true)); const s = await getDocs(q); const batches = []; let cb = writeBatch(db); let c = 0; s.docs.forEach(d => { cb.delete(d.ref); c++; if (c >= 400) { batches.push(cb.commit()); cb = writeBatch(db); c = 0; } }); if (c > 0) batches.push(cb.commit()); await Promise.all(batches); setTrashItems([]); showToast("Emptied."); } catch { showToast("Failed.", true); } setLoading(false); closeModal();
    }});
  };
  const mapOpts = (items) => [{ value: '', label: '-- None --' }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto pb-20 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Settings</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6"><Palette className="text-sky-600" size={24} /><h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Appearance</h2></div>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg mb-8">
          <span className="font-medium text-gray-700 dark:text-gray-300">Mode</span>
          <button onClick={toggleTheme} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-600 rounded-lg shadow-sm border border-gray-200 dark:border-gray-500">
            {theme === 'dark' ? <Moon size={18} className="text-indigo-400" /> : <Sun size={18} className="text-amber-500" />}<span className="text-sm font-bold uppercase">{theme}</span>
          </button>
        </div>
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4"><h3 className="text-sm font-bold text-gray-500 uppercase">Palettes</h3><button onClick={() => setShowCreator(!showCreator)} className="text-xs text-sky-600 font-bold hover:underline">{showCreator ? 'Cancel' : '+ New'}</button></div>
          {showCreator && (
            <form onSubmit={handleCreatePalette} className="mb-6 p-4 border border-dashed border-sky-300 bg-sky-50 dark:bg-sky-900/10 rounded-xl">
              <Input label="Name" value={newPaletteName} onChange={e => setNewPaletteName(e.target.value)} placeholder="Palette Name" required />
              <div className="grid grid-cols-2 gap-4 my-4">
                {['bgMain', 'bgSurface', 'primary', 'textMain'].map(key => (<div key={key}><label className="text-xs font-bold text-gray-500 block mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label><input type="color" value={newColors[key]} onChange={e => setNewColors({ ...newColors, [key]: e.target.value })} className="h-10 w-full p-0 border-0 rounded" /></div>))}
              </div>
              <Button type="submit" size="sm" className="w-full">Save Palette</Button>
            </form>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {allPalettes.map(palette => (<PalettePreview key={palette.id} name={palette.name} colors={palette.colors[theme] || palette.colors.light} isActive={activePaletteId === palette.id} onClick={() => handlePaletteSelect(palette)} onDelete={palette.type === 'custom' ? () => deleteCustomPalette(palette.id) : null} />))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Defaults</h3>
        <form onSubmit={handleSaveDefaults} className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          <Select label="Category" value={defaults.defaultCategory} onChange={e => setDefaults({ ...defaults, defaultCategory: e.target.value })} options={mapOpts(categories)} />
          <Select label="Place" value={defaults.defaultPlace} onChange={e => setDefaults({ ...defaults, defaultPlace: e.target.value })} options={mapOpts(places)} />
          <Select label="Tag" value={defaults.defaultTag} onChange={e => setDefaults({ ...defaults, defaultTag: e.target.value })} options={mapOpts(tags)} />
          <Select label="Mode" value={defaults.defaultMode} onChange={e => setDefaults({ ...defaults, defaultMode: e.target.value })} options={mapOpts(modesOfPayment)} />
          <div className="md:col-span-2"><Button type="submit" className="w-full">Save Defaults</Button></div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border dark:border-gray-700">
          <h3 className="text-xl font-bold mb-4">Members</h3>
          <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
            {(userSettings.allowed_emails || []).map(email => (<div key={email} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded"><span className="text-sm truncate mr-2">{email}</span>{email !== user?.email && <button onClick={() => handleRemoveMember(email)} className="text-red-500 text-xs font-bold shrink-0">REMOVE</button>}</div>))}
          </div>
          <form onSubmit={handleAddMember} className="flex gap-2"><Input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="Email" className="flex-1" /><Button type="submit">Add</Button></form>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border dark:border-gray-700">
           <div className="flex justify-between items-center mb-4">
             <h3 className="text-xl font-bold flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-500"/> System</h3>
             <div className="flex gap-2">
                {/* NEW: Repair Button - Shows only if issues exist */}
                {healthReport && healthReport.issues > 0 && (
                    <Button onClick={handleFixInvalidTypes} disabled={loading} variant="danger" size="sm" className="text-xs flex items-center gap-1">
                        <Wrench size={14}/> Fix
                    </Button>
                )}
                <Button onClick={handleRunIntegrityCheck} disabled={loading} variant="secondary" size="sm" className="text-xs">{loading ? "..." : "Check"}</Button>
             </div>
           </div>
           {healthReport ? (<div className="space-y-3"><div className={`p-3 rounded border flex items-center gap-2 ${healthReport.issues === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>{healthReport.issues === 0 ? <CheckCircle size={18}/> : <AlertTriangle size={18}/>}<span className="text-xs font-medium">{healthReport.issues === 0 ? "Healthy" : `${healthReport.issues} Issues Found`}</span></div>{healthReport.report.length > 0 && <div className="max-h-32 overflow-y-auto text-[10px] font-mono border rounded p-2">{healthReport.report.map((l, i) => <div key={i} className={l.type === 'error' ? 'text-red-500' : 'text-yellow-600'}>{l.message}</div>)}</div>}</div>) : <p className="text-sm text-gray-500">Run diagnostics to check status.</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
         <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4">CSV Data</h3>
            <div className="space-y-4"><Button onClick={() => exportToCSV(transactions, participantsLookup)} variant="secondary" className="w-full flex items-center justify-center gap-2"><Download size={16}/> Download CSV</Button><hr className="dark:border-gray-700"/><div><p className="text-sm text-gray-500 mb-2">Import CSV</p><button onClick={downloadCSVTemplate} className="text-xs text-sky-600 hover:underline mb-2 block">Download Template</button><input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} className="block w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-sky-50 file:text-sky-700"/><Button onClick={handleCSVImport} disabled={!csvFile || loading} className="w-full mt-2">Import CSV</Button></div></div>
         </div>
         <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border dark:border-gray-700">
            <h3 className="text-xl font-bold mb-4">Full Backup</h3>
            <div className="space-y-4"><Button onClick={handleExportJSON} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 flex justify-center gap-2"><Database size={16}/> Export Backup</Button><hr className="dark:border-gray-700"/><div><p className="text-sm text-red-500 mb-2 font-bold">Restore (Dangerous)</p><input type="file" accept=".json" onChange={handleImportJSON} className="block w-full text-xs text-gray-500 file:mr-2 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-red-50 file:text-red-700"/></div></div>
         </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold">Recycle Bin</h3><div className="flex gap-2"><Button onClick={handleEmptyTrash} variant="danger" size="sm" className="text-xs"><Trash2 size={14} className="mr-1 inline"/> Empty</Button>{!showTrash && <Button onClick={fetchTrash} variant="secondary" size="sm" className="text-xs">View Items</Button>}</div></div>
        {showTrash && (<div className="space-y-2">{trashItems.length === 0 ? <p className="text-gray-500 italic text-center">Empty</p> : trashItems.map(i => (<div key={i.id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded border border-red-100"><div className="text-xs"><p className="font-bold">{i.expenseName}</p><p>{formatCurrency(i.amount)}</p></div><div className="flex gap-2"><button onClick={() => handleRestore(i.id)} className="text-green-600 text-xs font-bold">RESTORE</button><button onClick={() => handleHardDelete(i.id)} className="text-red-600 text-xs font-bold">DELETE</button></div></div>))}<Button onClick={() => setShowTrash(false)} variant="ghost" className="w-full text-xs">Hide</Button></div>)}
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-lg shadow border border-red-200 dark:border-red-900">
        <h3 className="text-xl font-bold text-red-600 mb-6 flex items-center gap-2"><AlertTriangle size={20} /> Danger Zone</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">{['Transactions','Participants','Categories','Places','Tags','Modes'].map(n => (<Button key={n} onClick={() => handleNuke(n === 'Modes' ? 'modesOfPayment' : n.toLowerCase())} variant="danger" className="text-xs py-3">{n}</Button>))}</div>
      </div>

      <div className="flex justify-end mt-8 border-t pt-6 dark:border-gray-700"><Button onClick={handleSignOutRequest} variant="danger" className="flex items-center gap-2 px-6"><LogOut size={18} /> Sign Out</Button></div>
      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} confirmInputRequired={modalConfig.confirmInput} confirmText={modalConfig.confirmText} onConfirm={modalConfig.onConfirm} onCancel={closeModal} />
    </div>
  );
};

export default Settings;