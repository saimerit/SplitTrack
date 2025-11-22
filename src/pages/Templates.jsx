import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, FilePlus } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Transaction Templates</h2>
        <Button onClick={() => navigate('/add')} className="flex items-center gap-2">
            <FilePlus size={18} /> Create New via Form
        </Button>
      </div>
      
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Save frequently used transactions as templates to add them quickly.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
             <p className="col-span-full text-center text-gray-500 mt-8">No templates saved yet.</p>
        ) : (
            templates.map(t => {
                const amount = t.amount ? formatCurrency(Math.abs(t.amount)) : 'Variable';
                const cat = t.category || 'No Category';
                const participantCount = (t.participants || []).length + 1;

                return (
                    <div key={t.id} className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div>
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg text-gray-800 dark:text-gray-200 truncate" title={t.name}>
                                    {t.name}
                                </h3>
                                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                    {cat}
                                </span>
                            </div>
                            <p className="text-2xl font-bold text-sky-600 dark:text-sky-500 mb-1">{amount}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                {t.expenseName} • {participantCount} people
                            </p>
                        </div>
                        <div className="flex gap-3 mt-auto">
                            <Button onClick={() => handleApply(t)} className="flex-1 text-sm">
                                Use Template
                            </Button>
                            <button 
                                onClick={() => confirmDelete(t.id, t.name)} 
                                className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
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