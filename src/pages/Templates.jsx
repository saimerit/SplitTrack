import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, FilePlus, Zap, ZapOff } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { updateTemplate } from '../services/transactionService';
import { formatCurrency } from '../utils/formatters';
import Button from '../components/common/Button';
import ConfirmModal from '../components/modals/ConfirmModal';

const Templates = () => {
  const navigate = useNavigate();
  const { templates, showToast } = useAppStore();

  // Modal State
  const [deleteData, setDeleteData] = useState(null); // { id, name }

  const confirmDelete = (id, name) => {
    setDeleteData({ id, name });
  };

  const handleDelete = async () => {
    if (!deleteData) return;
    try {
      await deleteDoc(doc(db, 'ledgers/main-ledger/templates', deleteData.id));
      showToast("Template deleted.");
    } catch {
      showToast("Failed to delete template.", true);
    }
    setDeleteData(null);
  };

  const handleApply = (template) => {
    navigate('/add', { state: { ...template, isTemplateApply: true } });
    showToast("Template applied!");
  };

  const togglePin = async (template) => {
    try {
      await updateTemplate(template.id, { isPinned: !template.isPinned });
      showToast(template.isPinned ? "Unpinned from Quick Add" : "Pinned to Quick Add");
    } catch (e) {
      showToast("Failed to update pin", true);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="glass-card p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-amber-400 to-orange-400">Transaction Templates</h2>
            <p className="text-gray-400 mt-1">Quick-add frequently used transactions</p>
          </div>
          <Button onClick={() => navigate('/add')} className="gap-2">
            <FilePlus size={18} /> Create New via Form
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <p className="col-span-full text-center text-gray-500 mt-8">No templates saved yet.</p>
        ) : (
          templates.map(t => {
            const amount = t.amount ? formatCurrency(Math.abs(t.amount)) : 'Variable';
            const cat = t.category || 'No Category';
            const participantCount = (t.participants || []).length + 1;

            return (
              <div key={t.id} className="glass-card p-5 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-gray-200 truncate" title={t.name}>
                      {t.name}
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/5 text-gray-400">
                      {cat}
                    </span>
                  </div>
                  <p className="text-2xl font-bold mb-1" style={{ color: 'var(--primary)' }}>{amount}</p>
                  <p className="text-sm text-gray-500 mb-4">
                    {t.expenseName} • {participantCount} people
                  </p>
                </div>
                <div className="flex gap-3 mt-auto">
                  <Button onClick={() => handleApply(t)} className="flex-1 text-sm">
                    Use Template
                  </Button>
                  <button
                    onClick={() => togglePin(t)}
                    className={`p-2 rounded-lg border transition-all ${t.isPinned
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                      : 'border-white/10 text-gray-400 hover:text-amber-500 hover:border-amber-500/30'
                      }`}
                    title={t.isPinned ? "Unpin from Quick Add" : "Pin to Quick Add"}
                  >
                    {t.isPinned ? <Zap size={18} fill="currentColor" /> : <ZapOff size={18} />}
                  </button>
                  <button
                    onClick={() => confirmDelete(t.id, t.name)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteData}
        title="Delete Template?"
        message={`Are you sure you want to delete template "<strong>${deleteData?.name}</strong>"?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteData(null)}
        confirmInputRequired="DELETE"
        confirmText="Delete"
      />
    </div>
  );
};

export default Templates;