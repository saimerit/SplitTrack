import { useState } from 'react';
import { Trash2, Archive, RefreshCw } from 'lucide-react';
import useAppStore from '../store/useAppStore';
import { addDoc, collection, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import Input from '../components/common/Input';
import Button from '../components/common/Button';

const LEDGER_ID = 'main-ledger';

const SimpleManager = ({ title, data, collectionName, onDelete }) => {
  const [newItem, setNewItem] = useState('');
  
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    try {
      await addDoc(collection(db, `ledgers/${LEDGER_ID}/${collectionName}`), { name: newItem });
      setNewItem('');
    } catch {
      // Removed (error)
      alert("Error adding item");
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
              <button onClick={() => onDelete(item.id, collectionName)} className="text-gray-400 hover:text-red-500">
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

const ManageData = () => {
  const [activeTab, setActiveTab] = useState('participants');
  const { 
    participants, categories, places, tags, modesOfPayment, 
    showToast, transactions 
  } = useAppStore();

  const handleDelete = async (id, collectionName) => {
    if(!window.confirm("Delete this item?")) return;
    
    let isUsed = false;
    if (collectionName === 'categories') isUsed = transactions.some(t => t.category === categories.find(c=>c.id===id)?.name);
    else if (collectionName === 'places') isUsed = transactions.some(t => t.place === places.find(p=>p.id===id)?.name);
    else if (collectionName === 'tags') isUsed = transactions.some(t => t.tag === tags.find(tag=>tag.id===id)?.name);

    if (isUsed) {
      showToast("Cannot delete: Item is used in existing transactions.", true);
      return;
    }

    try {
      await deleteDoc(doc(db, `ledgers/${LEDGER_ID}/${collectionName}`, id));
      showToast("Deleted successfully");
    } catch {
      // Removed (error)
      showToast("Failed to delete", true);
    }
  };

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    const name = e.target.elements.name.value;
    if(!name) return;
    
    try {
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      await addDoc(collection(db, `ledgers/${LEDGER_ID}/participants`), {
        name,
        uniqueId: `P-${randomCode}`,
        isArchived: false
      });
      e.target.reset();
      showToast("Participant added!");
    } catch {
      // Removed (err)
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
      console.error(err); // Kept this one because it logs to console
    }
  };

  const tabs = [
    { id: 'participants', label: 'Participants' },
    { id: 'categories', label: 'Categories' },
    { id: 'places', label: 'Places' },
    { id: 'tags', label: 'Tags' },
    { id: 'modes', label: 'Modes' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200">Manage Data</h2>

      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-sky-600 text-sky-600 dark:border-sky-500 dark:text-sky-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="pt-4">
        {activeTab === 'participants' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
              <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">Add New Participant</h3>
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

        {activeTab === 'categories' && <SimpleManager title="Category" data={categories} collectionName="categories" onDelete={handleDelete} />}
        {activeTab === 'places' && <SimpleManager title="Place" data={places} collectionName="places" onDelete={handleDelete} />}
        {activeTab === 'tags' && <SimpleManager title="Tag" data={tags} collectionName="tags" onDelete={handleDelete} />}
        {activeTab === 'modes' && <SimpleManager title="Mode" data={modesOfPayment} collectionName="modesOfPayment" onDelete={handleDelete} />}
      </div>
    </div>
  );
};

export default ManageData;