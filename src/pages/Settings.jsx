import React, { useState } from 'react';
import useAppStore, { PALETTE_PRESETS } from '../store/useAppStore';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../hooks/useAuth';
import {
  Moon, Sun, Palette, Check, Trash2, Wrench,
  LogOut, ShieldCheck, AlertTriangle, CheckCircle, Database, Download, Monitor, Upload, FileJson, FileSpreadsheet, Activity, RotateCcw, Trash, ChevronDown, ChevronUp
} from 'lucide-react';
import { doc, updateDoc, setDoc, collection, writeBatch, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import { exportToCSV, exportFullBackup, importFromBackup, importFromCSV, nukeCollection, downloadCSVTemplate } from '../services/exportImportService';
import { runLedgerIntegrityChecks } from '../utils/integrityChecks';
import { restoreTransaction, permanentDeleteTransaction } from '../services/transactionService';
import { formatCurrency } from '../utils/formatters';
import RecurringManager from '../components/recurring/RecurringManager';

import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Select from '../components/common/Select';
import ConfirmModal from '../components/modals/ConfirmModal';

const PalettePreview = ({ colors, name, isActive, onClick, onDelete }) => {
  return (
    <div
      onClick={onClick}
      className={`relative group cursor-pointer rounded-2xl border transition-all duration-300 overflow-hidden ${isActive
        ? 'border-indigo-500 ring-2 ring-indigo-500/20 scale-105 shadow-2xl shadow-indigo-500/10'
        : 'border-white/10 hover:border-white/30 hover:shadow-lg'
        }`}
    >
      <div className="h-24 md:h-28 w-full flex flex-col text-[10px]" style={{ backgroundColor: colors.bgMain, color: colors.textMain }}>
        <div className="p-3 flex justify-between items-center border-b border-white/5">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-red-400/80"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-400/80"></div>
            <div className="w-2 h-2 rounded-full bg-green-400/80"></div>
          </div>
        </div>
        <div className="p-3 flex-1 flex flex-col gap-2 opacity-80">
          <div className="h-2 w-2/3 rounded bg-current opacity-20"></div>
          <div className="h-2 w-1/2 rounded bg-current opacity-20"></div>
          <div className="mt-auto p-2 rounded-lg flex justify-between items-center" style={{ backgroundColor: colors.bgSurface }}>
            <span className="opacity-70">Pay</span>
            <span className="font-bold" style={{ color: colors.primary }}>-$50</span>
          </div>
        </div>
      </div>
      <div className="p-3 bg-white/5 backdrop-blur-md text-xs font-bold text-center border-t border-white/5 text-gray-300 group-hover:text-white transition-colors">
        {name}
      </div>
      {isActive && (
        <div className="absolute top-2 right-2 bg-indigo-500 text-white rounded-full p-1 shadow-lg animate-scale-tap">
          <Check size={12} strokeWidth={3} />
        </div>
      )}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 left-2 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all scale-90 hover:scale-100"
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  );
};

const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
    <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
      <Icon size={20} />
    </div>
    <h2 className="text-lg font-bold text-gray-100 tracking-wide">{title}</h2>
  </div>
);

const Settings = () => {
  const { userSettings, categories, places, tags, modesOfPayment, setUserSettings, showToast, transactions, participants, activePaletteId, setActivePalette, customPalettes, addCustomPalette, deleteCustomPalette, deletedTransactions } = useAppStore();
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
  const [showTrash, setShowTrash] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', confirmInput: '', confirmText: 'Confirm', onConfirm: () => { } });

  const closeModal = () => setModalConfig(prev => ({ ...prev, isOpen: false }));
  const allPalettes = [...PALETTE_PRESETS, ...customPalettes];

  const handlePaletteSelect = (palette) => {
    console.log('handlePaletteSelect called with:', palette.id, palette.name);
    console.log('Current activePaletteId before set:', activePaletteId);

    setActivePalette(palette.id);

    console.log('Called setActivePalette with:', palette.id);

    // Auto-switch theme mode if the palette has a specific type (light/dark)
    // Custom palettes don't force a theme switch
    if (palette.type && palette.type !== 'custom') {
      if (palette.type !== theme) {
        console.log('Switching theme from', theme, 'to', palette.type);
        setTheme(palette.type);
        showToast(`Switched to ${palette.type} mode for ${palette.name}.`);
      }
    }
  };

  const handleRunDiagnostics = async () => {
    setLoading(true);
    try {
      const report = runLedgerIntegrityChecks(transactions, participants);
      setHealthReport(report);
      if (report.issues === 0) {
        showToast('All systems nominal. No issues found.');
      } else {
        showToast(`Found ${report.issues} issue(s). Check the report.`, true);
      }
    } catch (err) {
      console.error('Diagnostics error:', err);
      showToast('Failed to run diagnostics.', true);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDefaults = (e) => {
    e.preventDefault();
    setUserSettings({ ...userSettings, ...defaults });
    showToast('Smart defaults updated successfully.');
  };

  // --- Data Management Handlers ---
  const handleExportCSV = () => exportToCSV(transactions, new Map(participants.map(p => [p.uniqueId, p])));
  const handleJSONBackup = () => exportFullBackup({ transactions, participants, userSettings });

  const handleImport = async (e, type) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      if (type === 'json') await importFromBackup(file);
      else if (type === 'csv') await importFromCSV(file);
      showToast('Import successful! Please refresh.');
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      console.error(err);
      showToast('Import failed. Check console.', true);
    } finally {
      setLoading(false);
    }
  };

  const confirmReset = (collectionName) => {
    // Map UI names to actual collection names
    const collectionMap = {
      'transactions': 'transactions',
      'participants': 'participants',
      'categories': 'categories',
      'tags': 'tags',
      'places': 'places',
      'modes': 'modesofpayment',
      'recurring': 'recurring',
      'all data': 'ALL' // Special case
    };

    const actualCollection = collectionMap[collectionName.toLowerCase()] || collectionName.toLowerCase();

    setModalConfig({
      isOpen: true,
      title: `Reset ${collectionName}`,
      message: collectionName === 'All Data'
        ? '⚠️ This will delete ALL your data including transactions, participants, categories, tags, places, and modes. This cannot be undone!'
        : `Are you sure you want to delete ALL ${collectionName}? This cannot be undone.`,
      confirmInput: collectionName === 'All Data' ? 'DELETE ALL' : 'DELETE',
      confirmText: 'NUKE IT',
      onConfirm: async () => {
        setLoading(true);
        try {
          if (actualCollection === 'ALL') {
            // Delete all collections
            const allCollections = ['transactions', 'participants', 'categories', 'tags', 'places', 'modesofpayment', 'recurring', 'templates', 'goals'];
            for (const col of allCollections) {
              await nukeCollection(col);
            }
            showToast('All data has been deleted.');
          } else {
            await nukeCollection(actualCollection);
            showToast(`All ${collectionName} deleted.`);
          }
          setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
          console.error('Reset failed:', err);
          showToast('Reset failed.', true);
        } finally {
          setLoading(false);
          closeModal();
        }
      }
    });
  };

  const mapOpts = (items) => [{ value: '', label: '-- None --' }, ...items.map(i => ({ value: i.name, label: i.name }))];

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-24 animate-fade-in">

      {/* Header */}
      <div className="glass-card p-8">
        <h1 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-indigo-400 to-cyan-400 mb-2">
          Settings & Preferences
        </h1>
        <p className="text-gray-400">Customize your workspace and manage your data.</p>
      </div>

      {/* Appearance Section */}
      <div className="glass-card p-6 md:p-8">
        <SectionHeader icon={Palette} title="Appearance" />

        <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 mb-8 hover:bg-white/10 transition-colors">
          <div>
            <span className="block font-medium text-gray-200">Theme Mode</span>
            <span className="text-xs text-gray-500">Toggle between Light and Dark themes</span>
          </div>
          <button onClick={toggleTheme} className="flex items-center gap-3 px-4 py-2 bg-gray-900 rounded-lg border border-gray-700 hover:border-gray-500 transition-all">
            {theme === 'dark' ? <Moon size={18} className="text-indigo-400" /> : <Sun size={18} className="text-amber-400" />}
            <span className="text-sm font-bold uppercase text-gray-300">{theme}</span>
          </button>
        </div>

        <div className="mb-2">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Color Palettes</h3>
            <button onClick={() => setShowCreator(!showCreator)} className="text-xs text-indigo-400 font-bold hover:text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full transition-colors">
              {showCreator ? 'Cancel' : '+ Create Custom'}
            </button>
          </div>

          {showCreator && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const newPalette = {
                id: `custom_${Date.now()}`,
                name: newPaletteName,
                type: 'custom',
                colors: { light: newColors, dark: newColors }
              };
              addCustomPalette(newPalette);
              setNewPaletteName('');
              setShowCreator(false);
              showToast('Custom palette created!');
            }} className="mb-8 p-6 border border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-2xl animate-enter-card">
              <Input label="Palette Name" value={newPaletteName} onChange={e => setNewPaletteName(e.target.value)} placeholder="My Cool Theme" required className="bg-gray-900/50 border-gray-700 text-white" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4">
                {['bgMain', 'bgSurface', 'primary', 'textMain'].map(key => (
                  <div key={key}>
                    <label className="text-[10px] font-bold text-gray-500 block mb-2 uppercase tracking-wide">{key.replace(/([A-Z])/g, ' $1')}</label>
                    <div className="flex items-center gap-2 bg-gray-900 p-2 rounded-lg border border-gray-700">
                      <input type="color" value={newColors[key]} onChange={e => setNewColors({ ...newColors, [key]: e.target.value })} className="h-8 w-8 rounded cursor-pointer border-none bg-transparent" />
                      <span className="text-xs font-mono text-gray-400">{newColors[key]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="submit" size="sm" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white border-none shadow-lg shadow-indigo-500/20">Save Custom Palette</Button>
            </form>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allPalettes.map(palette => (
              <PalettePreview
                key={palette.id}
                name={palette.name}
                colors={palette.colors[theme] || palette.colors.light}
                isActive={activePaletteId === palette.id}
                onClick={() => handlePaletteSelect(palette)}
                onDelete={palette.type === 'custom' ? () => deleteCustomPalette(palette.id) : null}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Defaults Section */}
      <div className="glass-card p-6 md:p-8">
        <SectionHeader icon={Monitor} title="Smart Defaults" />
        <form onSubmit={handleSaveDefaults} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select label="Default Category" value={defaults.defaultCategory} onChange={e => setDefaults({ ...defaults, defaultCategory: e.target.value })} options={mapOpts(categories)} />
          <Select label="Default Place" value={defaults.defaultPlace} onChange={e => setDefaults({ ...defaults, defaultPlace: e.target.value })} options={mapOpts(places)} />
          <Select label="Default Tag" value={defaults.defaultTag} onChange={e => setDefaults({ ...defaults, defaultTag: e.target.value })} options={mapOpts(tags)} />
          <Select label="Default Mode" value={defaults.defaultMode} onChange={e => setDefaults({ ...defaults, defaultMode: e.target.value })} options={mapOpts(modesOfPayment)} />
          <div className="md:col-span-2 pt-2">
            <Button type="submit" className="w-full bg-white/10 hover:bg-white/20 text-white border-none">Save Defaults</Button>
          </div>
        </form>
      </div>

      {/* Recurring Manager */}
      <div className="glass-card p-6 md:p-8">
        <SectionHeader icon={CheckCircle} title="Subscriptions & Recurring" />
        <RecurringManager />
      </div>

      {/* Data Import/Export Section (RESTORED) */}
      <div className="glass-card p-6 md:p-8">
        <SectionHeader icon={Database} title="Data Management" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Export */}
          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <h3 className="text-sm font-bold text-gray-300 uppercase mb-4 flex items-center gap-2"><Download size={16} /> Export</h3>
            <div className="space-y-3">
              <Button onClick={handleExportCSV} variant="secondary" className="w-full justify-start gap-3 bg-gray-900 border-gray-700 text-gray-300">
                <FileSpreadsheet size={16} className="text-green-500" /> Export to CSV
              </Button>
              <Button onClick={handleJSONBackup} variant="secondary" className="w-full justify-start gap-3 bg-gray-900 border-gray-700 text-gray-300">
                <FileJson size={16} className="text-yellow-500" /> Full JSON Backup
              </Button>
            </div>
          </div>

          {/* Import */}
          <div className="p-4 bg-white/5 rounded-xl border border-white/5">
            <h3 className="text-sm font-bold text-gray-300 uppercase mb-4 flex items-center gap-2"><Upload size={16} /> Import</h3>
            <div className="space-y-3">
              <div className="relative">
                <Button variant="secondary" className="w-full justify-start gap-3 bg-gray-900 border-gray-700 text-gray-300">
                  <FileJson size={16} className="text-yellow-500" /> Restore from JSON
                </Button>
                <input type="file" accept=".json" onChange={e => handleImport(e, 'json')} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <div className="relative">
                <Button variant="secondary" className="w-full justify-start gap-3 bg-gray-900 border-gray-700 text-gray-300">
                  <FileSpreadsheet size={16} className="text-green-500" /> Import from CSV
                </Button>
                <input type="file" accept=".csv" onChange={e => handleImport(e, 'csv')} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>
            <button onClick={downloadCSVTemplate} className="mt-2 text-[10px] text-indigo-400 hover:underline">Download CSV Template</button>
          </div>
        </div>
      </div>

      {/* Members */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-gray-200 mb-4">Workspace Members</h3>
        <div className="space-y-2 mb-6 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {(userSettings.allowed_emails || []).map(email => (
            <div key={email} className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5 group hover:bg-white/10 transition-colors">
              <span className="text-sm text-gray-300 truncate">{email}</span>
              {email !== user?.email && (
                <button className="text-gray-600 group-hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
              )}
            </div>
          ))}
        </div>
        <form className="flex gap-2">
          <Input value={newMember} onChange={e => setNewMember(e.target.value)} placeholder="invite@email.com" className="bg-gray-900/50 border-gray-700" />
          <Button type="button" variant="secondary">Invite</Button>
        </form>
      </div>

      {/* System Health */}
      <div className="glass-card p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-200 flex items-center gap-2">
            <ShieldCheck size={20} className="text-emerald-400" /> System Health
          </h3>
          <Button onClick={handleRunDiagnostics} disabled={loading} variant="secondary" size="sm" className="text-xs h-8 gap-2">
            <Activity size={14} />
            {loading ? 'Running...' : 'Run Diagnostics'}
          </Button>
        </div>

        {healthReport ? (
          <div className={`p-4 rounded-xl ${healthReport.issues === 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'} border flex flex-col gap-3`}>
            <div className="flex items-center gap-3">
              {healthReport.issues === 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              <span className="font-mono text-sm">
                {healthReport.issues === 0 ? 'All systems nominal.' : `${healthReport.issues} issue(s) found`}
              </span>
            </div>
            {healthReport.report && healthReport.report.length > 0 && (
              <div className="max-h-40 overflow-y-auto text-xs space-y-1 mt-2 p-2 bg-black/20 rounded-lg">
                {healthReport.report.map((item, idx) => (
                  <div key={idx} className={`${item.type === 'error' ? 'text-red-400' : 'text-amber-400'}`}>
                    [{item.type.toUpperCase()}] {item.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Activity size={32} className="mb-2 opacity-20" />
            <p className="text-xs">System ready.</p>
          </div>
        )}
      </div>

      {/* Trash - Deleted Transactions */}
      <div className="glass-card p-6 md:p-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Trash size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-100 tracking-wide">Trash</h2>
              <p className="text-xs text-gray-500">
                {deletedTransactions.length} deleted item{deletedTransactions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {deletedTransactions.length > 0 && (
              <Button
                onClick={() => {
                  setModalConfig({
                    isOpen: true,
                    title: 'Empty Trash',
                    message: `Are you sure you want to permanently delete all ${deletedTransactions.length} item(s)? This cannot be undone.`,
                    confirmInput: 'EMPTY',
                    confirmText: 'Empty Trash',
                    onConfirm: async () => {
                      setLoading(true);
                      try {
                        for (const txn of deletedTransactions) {
                          await permanentDeleteTransaction(txn.id);
                        }
                        showToast(`Permanently deleted ${deletedTransactions.length} transactions.`);
                      } catch (err) {
                        console.error(err);
                        showToast('Failed to empty trash.', true);
                      } finally {
                        setLoading(false);
                        closeModal();
                      }
                    }
                  });
                }}
                variant="secondary"
                size="sm"
                className="text-xs text-red-400 border-red-500/20 hover:bg-red-500/10"
              >
                <Trash2 size={14} className="mr-1" /> Empty Trash
              </Button>
            )}
            <button
              onClick={() => setShowTrash(!showTrash)}
              className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
            >
              {showTrash ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </button>
          </div>
        </div>

        {showTrash && (
          <>
            {deletedTransactions.length > 0 ? (
              <div className="space-y-2 max-h-80 overflow-y-auto animate-slide-up">
                {deletedTransactions.slice(0, 20).map(txn => {
                  const date = txn.timestamp?.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
                  const formattedDate = isNaN(date.getTime()) ? 'Unknown Date' : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                  return (
                    <div key={txn.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 group hover:bg-white/10 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-300 truncate">{txn.expenseName || 'Unnamed Transaction'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{formattedDate}</span>
                          <span>•</span>
                          <span className={txn.amount < 0 ? 'text-emerald-400' : 'text-red-400'}>
                            {formatCurrency(Math.abs(txn.amount))}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        <button
                          onClick={async () => {
                            try {
                              await restoreTransaction(txn.id);
                              showToast('Transaction restored!');
                            } catch (err) {
                              console.error(err);
                              showToast('Failed to restore transaction.', true);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-emerald-400 transition-colors rounded hover:bg-white/5"
                          title="Restore"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={async () => {
                            if (window.confirm('Permanently delete this transaction? This cannot be undone.')) {
                              try {
                                await permanentDeleteTransaction(txn.id);
                                showToast('Transaction permanently deleted.');
                              } catch (err) {
                                console.error(err);
                                showToast('Failed to delete transaction.', true);
                              }
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded hover:bg-white/5"
                          title="Delete Permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
                {deletedTransactions.length > 20 && (
                  <p className="text-xs text-gray-500 text-center py-2">Showing 20 of {deletedTransactions.length} deleted items</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <Trash size={32} className="mb-2 opacity-20" />
                <p className="text-xs">Trash is empty</p>
              </div>
            )}
          </>
        )}
      </div>


      {/* Danger Zone (RESTORED) */}
      <div className="glass-card p-6 md:p-8 border-red-500/30 bg-red-500/5">
        <h3 className="text-xl font-bold text-red-400 mb-6 flex items-center gap-2">
          <AlertTriangle size={24} /> Danger Zone
        </h3>
        <p className="text-xs text-red-300/70 mb-4">These actions are irreversible. Proceed with caution.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <button onClick={() => confirmReset('Transactions')} className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Reset Transactions
          </button>
          <button onClick={() => confirmReset('Participants')} className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Reset Participants
          </button>
          <button onClick={() => confirmReset('Categories')} className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Reset Categories
          </button>
          <button onClick={() => confirmReset('Tags')} className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Reset Tags
          </button>
          <button onClick={() => confirmReset('Places')} className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Reset Places
          </button>
          <button onClick={() => confirmReset('Modes')} className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Reset Modes
          </button>
          <button onClick={() => confirmReset('Recurring')} className="px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/20 transition-all">
            Reset Recurring
          </button>
          <button onClick={() => confirmReset('All Data')} className="px-4 py-3 rounded-xl bg-red-600/20 hover:bg-red-600/40 text-red-300 text-xs font-bold border border-red-500/40 transition-all col-span-2 md:col-span-1">
            ⚠️ RESET ALL DATA
          </button>
        </div>
      </div>

      {/* Sign Out */}
      <div className="flex justify-center pt-8">
        <button onClick={logout} className="flex items-center gap-2 px-8 py-3 rounded-full bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-all border border-white/5 hover:border-red-500/30">
          <LogOut size={18} />
          <span className="font-medium">Sign Out of SplitTrack</span>
        </button>
      </div>

      <ConfirmModal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} confirmInputRequired={modalConfig.confirmInput} confirmText={modalConfig.confirmText} onConfirm={modalConfig.onConfirm} onCancel={closeModal} />
    </div >
  );
};

export default Settings;