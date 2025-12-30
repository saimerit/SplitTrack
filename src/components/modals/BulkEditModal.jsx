import { useState } from 'react';
import { X, Tag, Folder, CreditCard, Check } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import { bulkUpdateTransactions } from '../../services/transactionService';
import Button from '../common/Button';
import Select from '../common/Select';

const BulkEditModal = ({ isOpen, selectedIds, onClose, onSuccess }) => {
    const { categories, tags, modesOfPayment, showToast } = useAppStore();
    const [loading, setLoading] = useState(false);
    const [updateData, setUpdateData] = useState({
        category: '',
        tag: '',
        modeOfPayment: ''
    });

    if (!isOpen) return null;

    const handleApply = async () => {
        // Filter out empty values
        const cleanData = {};
        if (updateData.category) cleanData.category = updateData.category;
        if (updateData.tag) cleanData.tag = updateData.tag;
        if (updateData.modeOfPayment) cleanData.modeOfPayment = updateData.modeOfPayment;

        if (Object.keys(cleanData).length === 0) {
            showToast('Please select at least one field to update', true);
            return;
        }

        setLoading(true);
        try {
            await bulkUpdateTransactions([...selectedIds], cleanData);
            showToast(`Updated ${selectedIds.size} transactions successfully!`);
            onSuccess?.();
            onClose();
        } catch (error) {
            console.error('Bulk update failed:', error);
            showToast('Failed to update transactions', true);
        } finally {
            setLoading(false);
        }
    };

    const mapOpts = (items) => [
        { value: '', label: '-- No Change --' },
        ...items.map(i => ({ value: i.name, label: i.name }))
    ];

    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative glass-card w-full max-w-md p-6 animate-slide-up">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-gray-100">Bulk Edit</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            Update {selectedIds.size} selected transaction{selectedIds.size > 1 ? 's' : ''}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Fields */}
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                            <Folder size={18} />
                        </div>
                        <div className="flex-1">
                            <Select
                                label="Category"
                                value={updateData.category}
                                onChange={(e) => setUpdateData({ ...updateData, category: e.target.value })}
                                options={mapOpts(categories)}
                                className="bg-gray-900/50 border-gray-700"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                            <Tag size={18} />
                        </div>
                        <div className="flex-1">
                            <Select
                                label="Tag"
                                value={updateData.tag}
                                onChange={(e) => setUpdateData({ ...updateData, tag: e.target.value })}
                                options={mapOpts(tags)}
                                className="bg-gray-900/50 border-gray-700"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                            <CreditCard size={18} />
                        </div>
                        <div className="flex-1">
                            <Select
                                label="Payment Mode"
                                value={updateData.modeOfPayment}
                                onChange={(e) => setUpdateData({ ...updateData, modeOfPayment: e.target.value })}
                                options={mapOpts(modesOfPayment)}
                                className="bg-gray-900/50 border-gray-700"
                            />
                        </div>
                    </div>
                </div>

                {/* Info */}
                <p className="text-[10px] text-gray-500 mt-4 text-center">
                    Only selected fields will be updated. Empty fields are ignored.
                </p>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="flex-1 bg-gray-800 border-gray-700"
                        disabled={loading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleApply}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-500 border-none"
                        disabled={loading}
                    >
                        {loading ? (
                            <span className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Updating...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <Check size={16} />
                                Apply Changes
                            </span>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default BulkEditModal;
