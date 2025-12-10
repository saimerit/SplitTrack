import { useState } from 'react';
import { Trash2, Archive, RefreshCw, Layers, Edit2 } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { addDoc, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import ConfirmModal from '../components/modals/ConfirmModal';

const LEDGER_ID = 'main-ledger';

const SimpleManager = ({ title, data, collectionName, onDelete }) => {
  const [newItem, setNewItem] = useState('');
  const { showToast } = useAppStore();

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await addDoc(collection(db, `ledgers/${LEDGER_ID}/${collectionName}`), { name: newItem });
      setNewItem('');
      showToast(`${title} added!`);
    } catch {
      showToast(`Error adding ${title}`, true);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">Add New {title}</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <Input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={`Enter ${title} name`} />
          <Button type="submit" className="w-full">Add {title}</Button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
        <h3 className="p-4 border-b dark:border-gray-700 font-semibold dark:text-gray-200">Current {title}s</h3>
        <div className="divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
          {data.map(item => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700">
              <span className="dark:text-gray-300">{item.name}</span>
              <button onClick={() => onDelete(item.id, collectionName, item.name)} className="text-gray-400 hover:text-red-500">
                <Trash2 size={18} />
              </button>
            </div>
          ))}
          {data.length === 0 && <p className="p-4 text-gray-500 text-center">No items yet.</p>}
        </div>
      </div>
    </div>
  );
};

const CategoryManager = ({ data, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const { showToast } = useAppStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (isEditing) {
        await updateDoc(doc(db, `ledgers/${LEDGER_ID}/categories`, editId), {
          name,
          budget: budget ? parseFloat(budget) : 0
        });
        showToast(`Category updated!`);
        setIsEditing(false);
        setEditId(null);
      } else {
        await addDoc(collection(db, `ledgers/${LEDGER_ID}/categories`), {
          name,
          budget: budget ? parseFloat(budget) : 0
        });
        showToast(`Category added!`);
      }
      setName('');
      setBudget('');
    } catch (err) {
      console.error(err);
      showToast(`Error saving category`, true);
    }
  };

  const startEdit = (item) => {
    setIsEditing(true);
    setEditId(item.id);
    setName(item.name);
    setBudget(item.budget || '');
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditId(null);
    setName('');
    setBudget('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
        <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">{isEditing ? 'Edit Category' : 'Add New Category'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Category Name (e.g., Food)" required />
          <Input value={budget} onChange={e => setBudget(e.target.value)} type="number" placeholder="Monthly Budget Limit (Optional)" />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{isEditing ? 'Update Category' : 'Add Category'}</Button>
            {isEditing && <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button>}
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
        <h3 className="p-4 border-b dark:border-gray-700 font-semibold dark:text-gray-200">Current Categories</h3>
        <div className="divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
          {data.map(item => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700">
              <div>
                <span className="dark:text-gray-300 block font-medium">{item.name}</span>
                {item.budget > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">Budget: ₹{item.budget}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(item)} className="text-gray-400 hover:text-blue-500">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => onDelete(item.id, 'categories', item.name)} className="text-gray-400 hover:text-red-500">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
          {data.length === 0 && <p className="p-4 text-gray-500 text-center">No categories yet.</p>}
        </div>
      </div>
    </div>
  );
};

const ManageData = () => {
  const [activeTab, setActiveTab] = useState('participants');
  const {
    participants, categories, places, tags, modesOfPayment, groups,
    showToast, transactions
  } = useAppStore();

  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const handleDelete = (id, collectionName, name) => {
    // Check usage
    let isUsed = false;
    if (collectionName === 'categories') isUsed = transactions.some(t => t.category === name);
    else if (collectionName === 'places') isUsed = transactions.some(t => t.place === name);
    else if (collectionName === 'tags') isUsed = transactions.some(t => t.tag === name);

    // For groups, check if transactions exist in it
    if (collectionName === 'groups') {
      // Since 'transactions' in store are filtered, checking strict usage is harder locally.
      // We proceed with a warning modal implicitly.
    }

    if (isUsed) {
      showToast("Cannot delete: Item is used in existing transactions.", true);
      return;
    }

    setModalConfig({
      isOpen: true,
      title: `Delete ${name}?`,
      message: `Are you sure you want to delete <strong>${name}</strong>? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, `ledgers/${LEDGER_ID}/${collectionName}`, id));
          showToast("Deleted successfully");
        } catch {
          showToast("Failed to delete", true);
        }
        closeModal();
      }
    });
  };

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value;
    if (!name) return;

    try {
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      await addDoc(collection(db, `ledgers/${LEDGER_ID}/participants`), {
        name,
        uniqueId: `P-${randomCode}`,
        // CHANGE: Removed groupId to make participants global
        isArchived: false
      });
      e.target.reset();
      showToast("Participant added!");
    } catch {
      showToast("Error adding participant", true);
    }
  };

  const toggleArchive = async (p) => {
    try {
      await updateDoc(doc(db, `ledgers/${LEDGER_ID}/participants`, p.id), {
        isArchived: !p.isArchived
      });
      showToast(p.isArchived ? "Un-archived" : "Archived");
    } catch (err) {
      console.error(err);
    }
  };

  const tabs = [
    { id: 'participants', label: 'Participants', icon: <Archive size={16} /> },
    { id: 'groups', label: 'Spaces', icon: <Layers size={16} /> },
    { id: 'categories', label: 'Categories' },
    { id: 'places', label: 'Places' },
    { id: 'tags', label: 'Tags' },
    { id: 'modes', label: 'Modes' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Manage Data</h2>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-4 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-4 px-3 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${activeTab === tab.id
                ? 'border-sky-600 text-sky-600 dark:border-sky-500 dark:text-sky-500'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-4">
        {activeTab === 'participants' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">Add New Participant</h3>
              {/* CHANGE: Updated text to indicate global nature */}
              <p className="text-xs text-gray-500 mb-4">Participants are available in all spaces.</p>
              <form onSubmit={handleAddParticipant} className="space-y-4">
                <Input name="name" placeholder="Enter Name" required />
                <Button type="submit" className="w-full">Add Participant</Button>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
              <h3 className="p-4 border-b dark:border-gray-700 font-semibold dark:text-gray-200">Current Participants</h3>
              <div className="divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
                {participants.map(p => (
                  <div key={p.uniqueId} className={`p-4 flex justify-between items-center ${p.isArchived ? 'bg-gray-50 dark:bg-gray-700/50' : ''}`}>
                    <div>
                      <p className={`font-medium ${p.isArchived ? 'text-gray-400' : 'dark:text-gray-200'}`}>{p.name}</p>
                      <p className="text-xs text-gray-500">{p.uniqueId}</p>
                    </div>
                    <button onClick={() => toggleArchive(p)} className="text-gray-400 hover:text-sky-500" title={p.isArchived ? "Unarchive" : "Archive"}>
                      {p.isArchived ? <RefreshCw size={18} /> : <Archive size={18} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'groups' && <SimpleManager title="Space" data={groups} collectionName="groups" onDelete={handleDelete} />}
        {activeTab === 'categories' && <CategoryManager data={categories} onDelete={handleDelete} />}
        {activeTab === 'places' && <SimpleManager title="Place" data={places} collectionName="places" onDelete={handleDelete} />}
        {activeTab === 'tags' && <SimpleManager title="Tag" data={tags} collectionName="tags" onDelete={handleDelete} />}
        {activeTab === 'modes' && <SimpleManager title="Mode" data={modesOfPayment} collectionName="modesOfPayment" onDelete={handleDelete} />}
      </div>

      <ConfirmModal
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={closeModal}
      />
    </div>
  );
};

export default ManageData;