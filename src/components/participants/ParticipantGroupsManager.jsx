import { useState } from 'react';
import { Trash2, Edit2, Users, Plus, X, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { LEDGER_ID } from '../../config/constants';
import useAppStore from '../../store/useAppStore';
import Input from '../common/Input';
import Button from '../common/Button';
import ConfirmModal from '../modals/ConfirmModal';

const ParticipantGroupsManager = () => {
    const { participants, userSettings, setUserSettings, showToast } = useAppStore();

    // Form State
    const [isEditing, setIsEditing] = useState(false);
    const [editId, setEditId] = useState(null);
    const [groupName, setGroupName] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSearch, setShowSearch] = useState(false);

    // Delete Modal State
    const [deleteTarget, setDeleteTarget] = useState(null);

    // Get saved groups from userSettings
    const savedGroups = userSettings?.participantGroups || [];

    // Filter participants for search
    const filteredParticipants = participants.filter(p => {
        if (selectedMembers.includes(p.uniqueId)) return false;
        const term = searchTerm.toLowerCase();
        return p.name.toLowerCase().includes(term) || p.uniqueId.toLowerCase().includes(term);
    });

    // Save groups to Firestore and local store
    const saveGroupsToFirestore = async (groups) => {
        try {
            const newSettings = { ...userSettings, participantGroups: groups };
            await updateDoc(doc(db, `ledgers/${LEDGER_ID}`), { participantGroups: groups });
            setUserSettings(newSettings);
            return true;
        } catch (err) {
            console.error('Error saving groups:', err);
            showToast('Failed to save groups.', true);
            return false;
        }
    };

    // Add member to selection
    const addMember = (uid) => {
        setSelectedMembers([...selectedMembers, uid]);
        setSearchTerm('');
        setShowSearch(false);
    };

    // Remove member from selection
    const removeMember = (uid) => {
        setSelectedMembers(selectedMembers.filter(id => id !== uid));
    };

    // Get participant name by ID
    const getParticipantName = (uid) => {
        const p = participants.find(part => part.uniqueId === uid);
        return p ? p.name : uid;
    };

    // Handle form submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!groupName.trim()) {
            showToast('Please enter a group name.', true);
            return;
        }
        if (selectedMembers.length === 0) {
            showToast('Please add at least one member.', true);
            return;
        }

        let updatedGroups;
        if (isEditing) {
            updatedGroups = savedGroups.map(g =>
                g.id === editId ? { ...g, name: groupName, members: selectedMembers } : g
            );
        } else {
            const newGroup = {
                id: `group_${Date.now()}`,
                name: groupName,
                members: selectedMembers
            };
            updatedGroups = [...savedGroups, newGroup];
        }

        const success = await saveGroupsToFirestore(updatedGroups);
        if (success) {
            showToast(isEditing ? 'Group updated!' : 'Group created!');
            resetForm();
        }
    };

    // Start editing a group
    const startEdit = (group) => {
        setIsEditing(true);
        setEditId(group.id);
        setGroupName(group.name);
        setSelectedMembers([...group.members]);
    };

    // Reset form
    const resetForm = () => {
        setIsEditing(false);
        setEditId(null);
        setGroupName('');
        setSelectedMembers([]);
        setSearchTerm('');
    };

    // Confirm and delete group
    const handleDelete = async () => {
        if (!deleteTarget) return;

        // Immediately close modal to prevent "stuck" state
        const groupToDelete = deleteTarget;
        setDeleteTarget(null);

        const updatedGroups = savedGroups.filter(g => g.id !== groupToDelete.id);
        const success = await saveGroupsToFirestore(updatedGroups);

        if (success) {
            showToast('Group deleted successfully!');
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Create/Edit Form */}
            <div className="glass-card p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
                    <Users size={20} className="text-sky-400" />
                    {isEditing ? 'Edit Group' : 'Create New Group'}
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Group Name"
                        value={groupName}
                        onChange={e => setGroupName(e.target.value)}
                        placeholder="e.g., Trip Squad, Flatmates"
                        required
                    />

                    {/* Member Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                            Members ({selectedMembers.length})
                        </label>

                        {/* Selected Member Chips */}
                        <div className="flex flex-wrap gap-2 mb-3 min-h-[36px]">
                            {selectedMembers.map(uid => (
                                <span
                                    key={uid}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                >
                                    {getParticipantName(uid)}
                                    <button
                                        type="button"
                                        onClick={() => removeMember(uid)}
                                        className="hover:text-sky-100 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                            {selectedMembers.length === 0 && (
                                <span className="text-gray-500 text-sm">No members selected</span>
                            )}
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search participants to add..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setShowSearch(true); }}
                                onFocus={() => setShowSearch(true)}
                                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            />

                            {/* Search Results Dropdown */}
                            {showSearch && searchTerm && (
                                <div className="absolute z-20 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                    {filteredParticipants.length > 0 ? (
                                        filteredParticipants.slice(0, 10).map(p => (
                                            <button
                                                key={p.uniqueId}
                                                type="button"
                                                onMouseDown={(e) => { e.preventDefault(); addMember(p.uniqueId); }}
                                                className="w-full text-left px-4 py-2 hover:bg-gray-700 transition-colors"
                                            >
                                                <div className="font-medium text-gray-200">{p.name}</div>
                                                <div className="text-xs text-gray-500">{p.uniqueId}</div>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-4 py-3 text-gray-500 text-sm">No matches found</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Quick Add All */}
                        {participants.length > 0 && selectedMembers.length < participants.length && (
                            <button
                                type="button"
                                onClick={() => setSelectedMembers(participants.map(p => p.uniqueId))}
                                className="mt-2 text-xs text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1"
                            >
                                <Plus size={12} /> Add all participants
                            </button>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button type="submit" className="flex-1">
                            {isEditing ? 'Update Group' : 'Create Group'}
                        </Button>
                        {isEditing && (
                            <Button type="button" variant="secondary" onClick={resetForm}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </div>

            {/* Groups List */}
            <div className="glass-card overflow-hidden">
                <h3 className="p-4 border-b border-white/5 font-semibold text-gray-200 flex items-center gap-2">
                    <Users size={18} className="text-sky-400" />
                    Saved Groups ({savedGroups.length})
                </h3>

                <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                    {savedGroups.length > 0 ? savedGroups.map(group => (
                        <div
                            key={group.id}
                            className="p-4 hover:bg-white/5 transition-colors"
                        >
                            <div className="flex justify-between items-start">
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-medium text-gray-200 truncate">{group.name}</h4>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {group.members.length} member{group.members.length !== 1 ? 's' : ''}
                                    </p>

                                    {/* Member Preview */}
                                    <div className="flex flex-wrap gap-1 mt-2">
                                        {group.members.slice(0, 5).map(uid => (
                                            <span
                                                key={uid}
                                                className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-400"
                                            >
                                                {getParticipantName(uid)}
                                            </span>
                                        ))}
                                        {group.members.length > 5 && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-500">
                                                +{group.members.length - 5} more
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 ml-3 shrink-0">
                                    <button
                                        onClick={() => startEdit(group)}
                                        className="p-1.5 text-gray-400 hover:text-sky-400 transition-colors rounded hover:bg-white/5"
                                        title="Edit Group"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(group)}
                                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors rounded hover:bg-white/5"
                                        title="Delete Group"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <div className="p-8 text-center">
                            <Users size={32} className="mx-auto text-gray-600 mb-2" />
                            <p className="text-gray-500 text-sm">No groups created yet.</p>
                            <p className="text-gray-600 text-xs mt-1">
                                Create a group to quickly add participants to transactions.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={!!deleteTarget}
                title="Delete Group?"
                message={`Are you sure you want to delete "<strong>${deleteTarget?.name}</strong>"? This action cannot be undone.`}
                onConfirm={handleDelete}
                onCancel={() => setDeleteTarget(null)}
                confirmText="Delete"
            />
        </div>
    );
};

export default ParticipantGroupsManager;
