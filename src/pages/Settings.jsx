import React, { useState } from 'react';
import useAppStore, { PALETTE_PRESETS } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import {
  Moon, Sun, Palette, Check, Plus, Trash2,
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

// --- MINI PREVIEW COMPONENT ---
const PalettePreview = ({ colors, name, isActive, onClick, onDelete }) => {
  return (
    <div
      onClick={onClick}
      className={`relative group cursor-pointer rounded-xl border-2 transition-all overflow-hidden ${isActive ? 'border-sky-500 scale-105 shadow-lg' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'}`}
    >
      {/* Mini App UI Mockup */}
      <div className="h-28 w-full flex flex-col text-[10px]" style={{ backgroundColor: colors.bgMain, color: colors.textMain }}>
        {/* Header */}
        <div className="p-2 flex justify-between items-center border-b" style={{ borderColor: colors.border || 'rgba(0,0,0,0.1)' }}>
          <span className="font-bold opacity-75">9:41</span>
          <div className="flex gap-1"><div className="w-2 h-2 rounded-full bg-current"></div></div>
        </div>
        {/* Content */}
        <div className="p-2 flex-1 flex flex-col gap-2">
          <div className="p-2 rounded-lg shadow-sm flex justify-between items-center" style={{ backgroundColor: colors.bgSurface }}>
            <span>Expense</span>
            <span className="font-bold" style={{ color: colors.primary }}>-$50</span>
          </div>
          <div className="flex gap-2 mt-auto">
            <div className="flex-1 py-1 px-2 rounded text-center text-white font-bold opacity-90" style={{ backgroundColor: colors.primary }}>
              Add
            </div>
          </div>
        </div>
      </div>

      {/* Label */}
      <div className="p-2 bg-white dark:bg-gray-800 text-xs font-medium text-center border-t border-gray-100 dark:border-gray-700 truncate">
        {name}
      </div>

      {/* Active Indicator */}
      {isActive && (
        <div className="absolute top-2 right-2 bg-sky-500 text-white rounded-full p-1 shadow-sm">
          <Check size={12} />
        </div>
      )}

      {/* Delete Button (for custom) */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 left-2 bg-red-100 text-red-600 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};

const Settings = () => {
  const {
    userSettings, categories, places, tags, modesOfPayment,
    setUserSettings, showToast, transactions, participants, participantsLookup,
    activePaletteId, setActivePalette, customPalettes, addCustomPalette, deleteCustomPalette
  } = useAppStore();

  const { user, logout } = useAuth();
  const { theme, toggleTheme, setTheme } = useTheme();

  // --- STATE MANAGEMENT ---
  const [loading, setLoading] = useState(false);
  const [newMember, setNewMember] = useState('');
  const [defaults, setDefaults] = useState({
    defaultCategory: userSettings.defaultCategory || '',
    defaultPlace: userSettings.defaultPlace || '',
    defaultTag: userSettings.defaultTag || '',
    defaultMode: userSettings.defaultMode || ''
  });

  // Theme Designer State
  const [showCreator, setShowCreator] = useState(false);
  const [newPaletteName, setNewPaletteName] = useState('');
  const [newColors, setNewColors] = useState({
    bgMain: '#ffffff',
    bgSurface: '#f3f4f6',
    primary: '#3b82f6',
    textMain: '#000000'
  });

  // Data Tools State
  const [healthReport, setHealthReport] = useState(null);
  const [csvFile, setCsvFile] = useState(null);
  const [trashItems, setTrashItems] = useState([]);
  const [showTrash, setShowTrash] = useState(false);

  // Modal Config
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmInput: '',
    confirmText: 'Confirm',
    onConfirm: () => { }
  });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const allPalettes = [...PALETTE_PRESETS, ...customPalettes];

  // --- HANDLERS ---

  const handlePaletteSelect = (palette) => {
    console.log('Selecting palette:', palette.name, 'Current mode:', theme);

    setActivePalette(palette.id);

    // Force immediate re-render
    setTimeout(() => {
      // AUTO-SWITCH LOGIC: Force dark mode for Blackout
      if (palette.id === 'blackout') {
        if (theme !== 'dark') {
          setTheme('dark');
          showToast('Switched to dark mode for AMOLED black experience.');
        }
      } else if (palette.type && palette.type !== 'custom') {
        // For other themed presets, suggest the preferred mode
        if (palette.type !== theme && palette.id !== 'default') {
          setTheme(palette.type);
          showToast(`Switched to ${palette.type} mode for best experience.`);
        }
      }
    }, 50);
  };

  const handleCreatePalette = (e) => {
    e.preventDefault();
    if (!newPaletteName) return;
    const id = `custom_${Date.now()}`;
    const newPalette = {
      id,
      name: newPaletteName,
      type: 'custom',
      colors: {
        light: newColors,
        dark: newColors // Simplified: custom palettes apply same colors to both modes for now
      }
    };
    addCustomPalette(newPalette);
    setActivePalette(id);
    setShowCreator(false);
    setNewPaletteName('');
    showToast("Custom palette created!");
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
      // Helper to add unique metadata
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

      // Batch add transactions
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

  const handleEmptyTrash = async () => {
    setModalConfig({
      isOpen: true,
      title: "Empty Recycle Bin?",
      message: "Are you sure you want to permanently delete <strong class='text-red-600'>ALL</strong> items in the trash? This cannot be undone.",
      confirmInput: "EMPTY",
      confirmText: "Empty Trash",
      onConfirm: async () => {
        setLoading(true);
        try {
          const q = query(collection(db, 'ledgers/main-ledger/transactions'), where('isDeleted', '==', true));
          const snap = await getDocs(q);

          // Firestore batch limit is 500
          const batches = [];
          let currentBatch = writeBatch(db);
          let count = 0;

          snap.docs.forEach(doc => {
            currentBatch.delete(doc.ref);
            count++;
            if (count >= 400) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              count = 0;
            }
          });
          if (count > 0) batches.push(currentBatch.commit());

          await Promise.all(batches);

          setTrashItems([]);
          showToast("Recycle Bin Emptied.");
        } catch (e) {
          console.error(e);
          showToast("Failed to empty trash.", true);
        }
        setLoading(false);
        closeModal();
      }
    });
  };

  const mapOpts = (items) => [{ value: '', label: '-- None --' }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 animate-fade-in">

      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Settings</h1>
      </div>

      {/* --- THEME & VIBE SECTION --- */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="text-sky-600" size={24} />
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">Appearance & Vibe</h2>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg mb-8">
          <span className="font-medium text-gray-700 dark:text-gray-300">Color Mode</span>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-600 rounded-lg shadow-sm border border-gray-200 dark:border-gray-500 transition-all hover:scale-105"
          >
            {theme === 'dark' ? <Moon size={18} className="text-indigo-400" /> : <Sun size={18} className="text-amber-500" />}
            <span className="text-sm font-bold text-gray-700 dark:text-gray-200 uppercase">{theme}</span>
          </button>
        </div>

        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Color Palettes</h3>
            <button onClick={() => setShowCreator(!showCreator)} className="text-xs text-sky-600 font-bold hover:underline flex items-center gap-1">
              {showCreator ? 'Cancel' : '+ Create New'}
            </button>
          </div>

          {showCreator && (
            <form onSubmit={handleCreatePalette} className="mb-6 p-4 border border-dashed border-sky-300 bg-sky-50 dark:bg-sky-900/10 rounded-xl animate-scale-in">
              <h4 className="font-bold text-sky-800 dark:text-sky-200 mb-3">Designer Studio</h4>
              <Input label="Palette Name" value={newPaletteName} onChange={e => setNewPaletteName(e.target.value)} placeholder="e.g. Sunset Vibes" required />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {['bgMain', 'bgSurface', 'primary', 'textMain'].map(key => (
                  <div key={key}>
                    <label className="text-xs font-bold text-gray-500 block mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                    <div className="flex gap-2">
                      <input type="color" value={newColors[key]} onChange={e => setNewColors({ ...newColors, [key]: e.target.value })} className="h-10 w-10 p-0 border-0 rounded cursor-pointer" />
                    </div>
                  </div>
                ))}
              </div>
              <Button type="submit" size="sm">Save Palette</Button>
            </form>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {allPalettes.map(palette => {
              const displayColors = palette.colors[theme] || palette.colors.light;
              return (
                <PalettePreview
                  key={palette.id}
                  name={palette.name}
                  colors={displayColors}
                  isActive={activePaletteId === palette.id}
                  onClick={() => handlePaletteSelect(palette)}
                  onDelete={palette.type === 'custom' ? () => deleteCustomPalette(palette.id) : null}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* --- PREFERENCES --- */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Default Values</h3>
        <form onSubmit={handleSaveDefaults} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select label="Default Category" value={defaults.defaultCategory} onChange={e => setDefaults({ ...defaults, defaultCategory: e.target.value })} options={mapOpts(categories)} />
          <Select label="Default Place" value={defaults.defaultPlace} onChange={e => setDefaults({ ...defaults, defaultPlace: e.target.value })} options={mapOpts(places)} />
          <Select label="Default Tag" value={defaults.defaultTag} onChange={e => setDefaults({ ...defaults, defaultTag: e.target.value })} options={mapOpts(tags)} />
          <Select label="Default Mode" value={defaults.defaultMode} onChange={e => setDefaults({ ...defaults, defaultMode: e.target.value })} options={mapOpts(modesOfPayment)} />
          <div className="md:col-span-2">
            <Button type="submit" className="w-full">Save Defaults</Button>
          </div>
        </form>
      </div>

      {/* --- MEMBERS & HEALTH GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Manage Members</h3>
          <div className="space-y-2 mb-6 max-h-40 overflow-y-auto">
            {(userSettings.allowed_emails || []).map(email => (
              <div key={email} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                <span className="text-gray-700 dark:text-gray-300 truncate text-sm">{email} {email === user?.email && '(You)'}</span>
                {email !== user?.email && (
                  <button onClick={() => handleRemoveMember(email)} className="text-red-500 hover:text-red-700 text-xs font-bold">REMOVE</button>
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
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <ShieldCheck size={20} className="text-emerald-500" /> System Health
            </h3>
            <Button onClick={handleRunIntegrityCheck} disabled={loading} variant="secondary" className="text-sm">
              {loading ? "Checking..." : "Run Diagnostics"}
            </Button>
          </div>
          {healthReport ? (
            <div className="space-y-3">
              <div className={`p-3 rounded-lg border flex items-center gap-3 ${healthReport.issues === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
                {healthReport.issues === 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                <span className="font-medium text-sm">
                  {healthReport.issues === 0 ? "System healthy." : `Found ${healthReport.issues} potential issue(s).`}
                </span>
              </div>
              {healthReport.report.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto border rounded p-2 bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
                  {healthReport.report.map((log, idx) => (
                    <div key={idx} className="text-[10px] font-mono py-1 border-b last:border-0 border-gray-200 dark:border-gray-700 dark:text-gray-300">
                      <span className={`font-bold ${log.type === 'error' ? 'text-red-500' : 'text-yellow-600'}`}>[{log.type.toUpperCase()}]</span> {log.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : <p className="text-sm text-gray-500 italic">Run diagnostics to check data integrity.</p>}
        </div>
      </div>

      {/* --- CSV & BACKUP GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">CSV Data</h3>
          <div className="space-y-4">
            <Button onClick={() => exportToCSV(transactions, participantsLookup)} variant="secondary" className="w-full flex items-center justify-center gap-2">
              <Download size={16} /> Download Transactions CSV
            </Button>
            <hr className="dark:border-gray-700" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Import CSV (Legacy or Backup)</p>
              <button onClick={downloadCSVTemplate} className="text-xs text-sky-600 hover:underline mb-3 block">
                Download CSV Import Template
              </button>
              <input type="file" accept=".csv" onChange={e => setCsvFile(e.target.files[0])} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 dark:file:bg-gray-700 dark:file:text-gray-200" />
              <Button onClick={handleCSVImport} disabled={!csvFile || loading} className="w-full mt-2">
                {loading ? 'Importing...' : 'Import Transactions'}
              </Button>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-4">Full Backup (JSON)</h3>
          <div className="space-y-4">
            <Button onClick={handleExportJSON} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center gap-2">
              <Database size={16} /> {loading ? 'Exporting...' : 'Export Full Backup'}
            </Button>
            <hr className="dark:border-gray-700" />
            <div>
              <p className="text-sm text-red-500 mb-2 font-medium">Restore (Wipes existing data!)</p>
              <input type="file" accept=".json" onChange={handleImportJSON} disabled={loading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 dark:file:bg-gray-700 dark:file:text-red-300" />
            </div>
          </div>
        </div>
      </div>

      {/* --- RECYCLE BIN --- */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">Recycle Bin</h3>
          <div className="flex gap-2">
            <Button onClick={handleEmptyTrash} variant="danger" size="sm" className="text-xs">
              <Trash2 size={14} className="mr-1 inline" /> Empty Trash
            </Button>
            {!showTrash && <Button onClick={fetchTrash} variant="secondary" size="sm">View Deleted Items</Button>}
          </div>
        </div>

        {showTrash && (
          <div className="space-y-2">
            <div className="flex justify-end mb-2">
              <Button onClick={handleEmptyTrash} variant="ghost" size="xs" className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                Empty Trash
              </Button>
            </div>
            {trashItems.length === 0 ? <p className="text-gray-500 italic p-4 text-center">Trash is empty.</p> :
              trashItems.map(item => (
                <div key={item.id} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-100 dark:border-red-900">
                  <div>
                    <p className="font-medium dark:text-gray-200 text-sm">{item.expenseName}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.amount)} • {new Date(item.timestamp?.seconds * 1000).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => handleRestore(item.id)} className="text-green-600 hover:underline text-xs font-bold">RESTORE</button>
                    <button onClick={() => handleHardDelete(item.id)} className="text-red-600 hover:underline text-xs font-bold">DELETE FOREVER</button>
                  </div>
                </div>
              ))
            }
            <Button onClick={() => setShowTrash(false)} variant="ghost" className="mt-4 w-full">Hide Trash</Button>
          </div>
        )}
      </div>

      {/* --- DANGER ZONE --- */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-red-200 dark:border-red-900">
        <h3 className="text-xl font-bold text-red-600 mb-6 flex items-center gap-2"><AlertTriangle size={20} /> Danger Zone</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Button onClick={() => handleNuke('transactions')} variant="danger" className="text-xs">Nuke Transactions</Button>
          <Button onClick={() => handleNuke('participants')} variant="danger" className="text-xs">Nuke Participants</Button>
          <Button onClick={() => handleNuke('categories')} variant="danger" className="text-xs">Nuke Categories</Button>
          <Button onClick={() => handleNuke('places')} variant="danger" className="text-xs">Nuke Places</Button>
          <Button onClick={() => handleNuke('tags')} variant="danger" className="text-xs">Nuke Tags</Button>
          <Button onClick={() => handleNuke('modesOfPayment')} variant="danger" className="text-xs">Nuke Modes</Button>
        </div>
      </div>

      {/* --- FOOTER ACTIONS --- */}
      <div className="flex justify-end mt-8 border-t pt-6 dark:border-gray-700">
        <Button onClick={handleSignOutRequest} variant="danger" className="flex items-center gap-2 px-6">
          <LogOut size={18} /> Sign Out
        </Button>
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