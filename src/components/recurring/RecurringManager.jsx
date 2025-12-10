import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { addRecurringTransaction, updateRecurringTransaction, deleteRecurringTransaction } from '../../services/transactionService';
import { Trash2, Edit2, Plus, Calendar, Repeat } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import ConfirmModal from '../modals/ConfirmModal';
import { formatCurrency } from '../../utils/formatters';
import useAppStore from '../../store/useAppStore';

const RecurringManager = () => {
    const { showToast, modesOfPayment, tags, places } = useAppStore();
    const [items, setItems] = useState([]);
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [deleteId, setDeleteId] = useState(null); // For ConfirmModal

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        frequency: 'monthly',
        nextDueDate: '',
        category: '',
        paymentMode: '', // New
        tag: '', // New
        place: '' // New
    });

    const LEDGER_ID = 'main-ledger';

    useEffect(() => {
        const q = query(collection(db, `ledgers/${LEDGER_ID}/recurring`));
        const unsub = onSnapshot(q, (snap) => {
            setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const mapOptions = (list) => [
        { value: '', label: '-- Select --' },
        ...list.map(i => ({ value: i.name, label: i.name }))
    ];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.amount || !formData.nextDueDate) {
            showToast('Please fill required fields', true);
            return;
        }

        try {
            // Create Timestamp
            const dateParts = formData.nextDueDate.split('-');
            const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
            dateObj.setHours(12, 0, 0, 0);

            const payload = {
                name: formData.name,
                amount: parseFloat(formData.amount) * 100,
                frequency: formData.frequency,
                nextDueDate: dateObj,
                category: formData.category || 'Recurring',
                paymentMode: formData.paymentMode || 'Online',
                tag: formData.tag || '',
                place: formData.place || ''
            };

            if (isEditing) {
                await updateRecurringTransaction(editId, payload);
                showToast('Recurring Rule Updated');
            } else {
                await addRecurringTransaction(payload);
                showToast('Recurring Rule Added');
            }
            resetForm();
        } catch (err) {
            console.error(err);
            showToast('Error saving rule', true);
        }
    };

    const handleEdit = (item) => {
        setIsEditing(true);
        setEditId(item.id);

        let d = new Date();
        if (item.nextDueDate && item.nextDueDate.toDate) {
            d = item.nextDueDate.toDate();
        } else if (item.nextDueDate instanceof Date) {
            d = item.nextDueDate;
        }

        const isoDate = d.toISOString().split('T')[0];

        setFormData({
            name: item.name,
            amount: (item.amount / 100).toFixed(2),
            frequency: item.frequency || 'monthly',
            nextDueDate: isoDate,
            category: item.category || '',
            paymentMode: item.paymentMode || '',
            tag: item.tag || '',
            place: item.place || ''
        });
    };

    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setFormData({ name: '', amount: '', frequency: 'monthly', nextDueDate: '', category: '', paymentMode: '', tag: '', place: '' });
    };

    const confirmDelete = async () => {
        if (!deleteId) return;
        try {
            await deleteRecurringTransaction(deleteId);
            showToast('Deleted');
        } catch (e) {
            showToast('Failed to delete', true);
        }
        setDeleteId(null);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Form */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border dark:border-gray-700">
                <h3 className="text-lg font-semibold mb-4 dark:text-gray-200">
                    {isEditing ? 'Edit Recurring Rule' : 'Add Recurring Rule'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Name"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Netflix, Rent"
                        required
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Amount"
                            type="number"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            placeholder="0.00"
                            required
                        />
                        <Select
                            label="Frequency"
                            value={formData.frequency}
                            onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                            options={[
                                { value: 'monthly', label: 'Monthly' },
                                { value: 'yearly', label: 'Yearly' }
                            ]}
                        />
                    </div>
                    <Input
                        label="Next Due Date"
                        type="date"
                        value={formData.nextDueDate}
                        onChange={e => setFormData({ ...formData, nextDueDate: e.target.value })}
                        required
                    />

                    {/* New Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Payment Mode"
                            value={formData.paymentMode}
                            onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
                            options={mapOptions(modesOfPayment)}

                        />
                        <Select
                            label="Tag"
                            value={formData.tag}
                            onChange={e => setFormData({ ...formData, tag: e.target.value })}
                            options={mapOptions(tags)}
                        />
                    </div>
                    <Select
                        label="Place"
                        value={formData.place}
                        onChange={e => setFormData({ ...formData, place: e.target.value })}
                        options={mapOptions(places)}
                    />

                    <div className="flex gap-2 pt-2">
                        <Button type="submit" className="flex-1">
                            {isEditing ? 'Update Rule' : 'Add Rule'}
                        </Button>
                        {isEditing && (
                            <Button type="button" variant="secondary" onClick={resetForm}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border dark:border-gray-700 overflow-hidden">
                <h3 className="p-4 border-b dark:border-gray-700 font-semibold dark:text-gray-200 flex items-center gap-2">
                    <Repeat size={18} /> Active Subscriptions
                </h3>
                <div className="divide-y dark:divide-gray-700 max-h-96 overflow-y-auto">
                    {items.map(item => (
                        <div key={item.id} className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="min-w-0 flex-1 pr-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-800 dark:text-gray-200">{item.name}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                                        {item.frequency}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-500 mt-1 flex items-center gap-4">
                                    <span className="font-mono text-gray-700 dark:text-gray-300">{formatCurrency(item.amount)}</span>
                                    <span className="flex items-center gap-1 text-xs">
                                        <Calendar size={12} />
                                        {item.nextDueDate?.toDate ? item.nextDueDate.toDate().toLocaleDateString() : 'Invalid Date'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-sky-500 rounded-full hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={() => setDeleteId(item.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {items.length === 0 && (
                        <div className="p-8 text-center text-gray-400">
                            <p>No recurring transactions found.</p>
                            <p className="text-sm mt-1">Add one to automate your bills.</p>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!deleteId}
                title="Delete Recurring Rule?"
                message="Are you sure you want to stop tracking this recurring expense?"
                confirmText="Delete"
                confirmInputRequired="DELETE"
                onConfirm={confirmDelete}
                onCancel={() => setDeleteId(null)}
            />
        </div>
    );
};

export default RecurringManager;
