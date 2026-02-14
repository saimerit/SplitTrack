import { useState } from 'react';
import { Trash2, Archive, RefreshCw, Layers, Edit2, Repeat, UsersRound, Sparkles, ShieldCheck, Search, Copy, Check, X } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { addDoc, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import ConfirmModal from '../components/modals/ConfirmModal';
import RecurringManager from '../components/recurring/RecurringManager';
import ParticipantGroupsManager from '../components/participants/ParticipantGroupsManager';
import SmartRulesManager from '../components/rules/SmartRulesManager';
import DataHealthCheck from '../components/data/DataHealthCheck';

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
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">Add New {title}</h3>
        <form onSubmit={handleAdd} className="space-y-4">
          <Input value={newItem} onChange={e => setNewItem(e.target.value)} placeholder={`Enter ${title} name`} />
          <Button type="submit" className="w-full">Add {title}</Button>
        </form>
      </div>

      <div className="glass-card overflow-hidden">
        <h3 className="p-4 border-b border-white/5 font-semibold text-gray-200">Current {title}s</h3>
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {data.map(item => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-white/5">
              <span className="text-gray-300 truncate pr-4 min-w-0 flex-1" title={item.name}>{item.name}</span>
              <button onClick={() => onDelete(item.id, collectionName, item.name)} className="text-gray-400 hover:text-red-500 shrink-0">
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
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">{isEditing ? 'Edit Category' : 'Add New Category'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Category Name (e.g., Food)" required />
          <Input value={budget} onChange={e => setBudget(e.target.value)} type="number" placeholder="Monthly Budget Limit (Optional)" />
          <div className="flex gap-2">
            <Button type="submit" className="flex-1">{isEditing ? 'Update Category' : 'Add Category'}</Button>
            {isEditing && <Button type="button" variant="secondary" onClick={cancelEdit}>Cancel</Button>}
          </div>
        </form>
      </div>

      <div className="glass-card overflow-hidden">
        <h3 className="p-4 border-b border-white/5 font-semibold text-gray-200">Current Categories</h3>
        <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
          {data.map(item => (
            <div key={item.id} className="p-4 flex justify-between items-center hover:bg-white/5">
              <div className="min-w-0 flex-1 pr-4">
                <span className="text-gray-300 block font-medium truncate" title={item.name}>{item.name}</span>
                {item.budget > 0 && <span className="text-xs text-gray-500">Budget: ₹{item.budget}</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
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



const TransactionSearch = () => {
  const { transactions, showToast } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [limit, setLimit] = useState(10);
  const [copiedId, setCopiedId] = useState(null);

  const handleSearch = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val || val.length < 2) {
      setResults([]);
      return;
    }

    const lowerVal = val.toLowerCase();
    // Filter transactions (client-side for now as we have them in store)
    const matches = transactions.filter(t =>
      (t.expenseName && t.expenseName.toLowerCase().includes(lowerVal)) ||
      (t.amount && t.amount.toString().includes(val))
    ).sort((a, b) => {
      // Sort by date desc
      const ta = a.timestamp?.seconds || 0;
      const tb = b.timestamp?.seconds || 0;
      return tb - ta;
    });

    setResults(matches);
  };

  const copyToClipboard = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    showToast("ID copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const displayResults = results.slice(0, limit);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="glass-card p-6 h-fit">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">Search Transaction ID</h3>
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={handleSearch}
              placeholder="Search by name or amount..."
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-gray-200 focus:outline-none focus:ring-2 focus:ring-sky-500/50 transition-all placeholder:text-gray-500"
            />
          </div>
          <p className="text-xs text-gray-500">
            Found {results.length} matches. {results.length > limit ? `Showing top ${limit}.` : ''}
          </p>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <h3 className="p-4 border-b border-white/5 font-semibold text-gray-200">Results</h3>
        <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
          {displayResults.map(t => (
            <div key={t.id} className="p-4 hover:bg-white/5 transition-colors group">
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-gray-200 line-clamp-1">{t.expenseName}</span>
                <span className={`font-mono font-bold ${t.amount < 0 ? 'text-green-400' : 'text-gray-200'}`}>
                  {t.amount < 0 ? '+' : ''}₹{Math.abs(t.amount / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <span>{t.dateString || new Date(t.timestamp?.seconds * 1000).toLocaleDateString()}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-black/20 px-2 py-0.5 rounded text-gray-400 select-all">
                    {t.id}
                  </span>
                  <button
                    onClick={() => copyToClipboard(t.id)}
                    className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-sky-400 transition-colors"
                    title="Copy ID"
                  >
                    {copiedId === t.id ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {query && results.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No transactions found matching "{query}"
            </div>
          )}
          {!query && (
            <div className="p-8 text-center text-gray-500">
              Start typing to search...
            </div>
          )}
          {results.length > limit && (
            <button
              onClick={() => setLimit(l => l + 20)}
              className="w-full p-3 text-sm text-sky-400 hover:text-sky-300 hover:bg-white/5 transition-colors"
            >
              Load More
            </button>
          )}
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
  const [editingParticipant, setEditingParticipant] = useState(null);

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

  const handleRenameParticipant = async () => {
    if (!editingParticipant || !editingParticipant.name.trim()) return;
    try {
      await updateDoc(doc(db, `ledgers/${LEDGER_ID}/participants`, editingParticipant.id), {
        name: editingParticipant.name.trim()
      });
      showToast('Participant renamed!');
      setEditingParticipant(null);
    } catch (err) {
      console.error(err);
      showToast('Error renaming participant', true);
    }
  };

  const tabs = [
    { id: 'participants', label: 'Participants', icon: <Archive size={16} /> },
    { id: 'participantGroups', label: 'Groups', icon: <UsersRound size={16} /> },
    { id: 'groups', label: 'Spaces', icon: <Layers size={16} /> },
    { id: 'categories', label: 'Categories' },
    { id: 'places', label: 'Places' },
    { id: 'tags', label: 'Tags' },
    { id: 'modes', label: 'Modes' },
    { id: 'recurring', label: 'Recurring', icon: <Repeat size={16} /> },
    { id: 'smartRules', label: 'Smart Rules', icon: <Sparkles size={16} /> },
    { id: 'dataHealth', label: 'Data Health', icon: <ShieldCheck size={16} /> },
    { id: 'searchIds', label: 'Find IDs', icon: <Search size={16} /> },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24">
      <div className="glass-card p-6 md:p-8">
        <h2 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-linear-to-r from-cyan-400 to-blue-400">Manage Data</h2>
        <p className="text-gray-400 mt-1">Configure your categories, participants, and other data</p>
      </div>

      <div className="glass-card p-4 md:p-6">
        <nav className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center gap-2 ${activeTab === tab.id
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-2">
        {activeTab === 'participants' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-200">Add New Participant</h3>
              <p className="text-xs text-gray-500 mb-4">Participants are available in all spaces.</p>
              <form onSubmit={handleAddParticipant} className="space-y-4">
                <Input name="name" placeholder="Enter Name" required />
                <Button type="submit" className="w-full">Add Participant</Button>
              </form>
            </div>

            <div className="glass-card overflow-hidden">
              <h3 className="p-4 border-b border-white/5 font-semibold text-gray-200">Current Participants</h3>
              <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
                {participants.map(p => (
                  <div key={p.uniqueId} className={`p-4 flex justify-between items-center ${p.isArchived ? 'opacity-50' : ''}`}>
                    <div className="min-w-0 flex-1 pr-3">
                      {editingParticipant?.id === p.id ? (
                        <input
                          autoFocus
                          value={editingParticipant.name}
                          onChange={e => setEditingParticipant({ ...editingParticipant, name: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleRenameParticipant();
                            if (e.key === 'Escape') setEditingParticipant(null);
                          }}
                          className="w-full bg-white/10 border border-sky-500/50 rounded px-2 py-1 text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      ) : (
                        <>
                          <p className={`font-medium ${p.isArchived ? 'text-gray-500' : 'text-gray-200'}`}>{p.name}</p>
                          <p className="text-xs text-gray-500">{p.uniqueId}</p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {editingParticipant?.id === p.id ? (
                        <>
                          <button onClick={handleRenameParticipant} className="text-gray-400 hover:text-green-500" title="Save">
                            <Check size={18} />
                          </button>
                          <button onClick={() => setEditingParticipant(null)} className="text-gray-400 hover:text-red-500" title="Cancel">
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setEditingParticipant({ id: p.id, name: p.name })} className="text-gray-400 hover:text-sky-500" title="Edit Name">
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => toggleArchive(p)} className="text-gray-400 hover:text-sky-500" title={p.isArchived ? "Unarchive" : "Archive"}>
                            {p.isArchived ? <RefreshCw size={18} /> : <Archive size={18} />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'participantGroups' && <ParticipantGroupsManager />}
        {activeTab === 'groups' && <SimpleManager title="Space" data={groups} collectionName="groups" onDelete={handleDelete} />}
        {activeTab === 'categories' && <CategoryManager data={categories} onDelete={handleDelete} />}
        {activeTab === 'places' && <SimpleManager title="Place" data={places} collectionName="places" onDelete={handleDelete} />}
        {activeTab === 'tags' && <SimpleManager title="Tag" data={tags} collectionName="tags" onDelete={handleDelete} />}
        {activeTab === 'modes' && <SimpleManager title="Mode" data={modesOfPayment} collectionName="modesOfPayment" onDelete={handleDelete} />}
        {activeTab === 'recurring' && <RecurringManager />}
        {activeTab === 'smartRules' && <SmartRulesManager />}
        {activeTab === 'dataHealth' && <DataHealthCheck />}
        {activeTab === 'searchIds' && <TransactionSearch />}
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