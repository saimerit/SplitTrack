import { useState } from 'react';
import { Plus, Trash2, Sparkles, Tag, Folder, CreditCard, MapPin } from 'lucide-react';
import useAppStore from '../../store/useAppStore';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';

const SmartRulesManager = () => {
    const { smartRules, categories, tags, modesOfPayment, places, addSmartRule, deleteSmartRule, showToast } = useAppStore();
    const [isAdding, setIsAdding] = useState(false);
    const [newRule, setNewRule] = useState({
        keyword: '',
        targetCategory: '',
        targetTag: '',
        targetMode: '',
        targetPlace: ''
    });

    const handleAdd = () => {
        if (!newRule.keyword.trim()) {
            showToast('Please enter a keyword to match', true);
            return;
        }

        if (!newRule.targetCategory && !newRule.targetTag && !newRule.targetMode && !newRule.targetPlace) {
            showToast('Please select at least one target field', true);
            return;
        }

        addSmartRule(newRule);
        setNewRule({ keyword: '', targetCategory: '', targetTag: '', targetMode: '', targetPlace: '' });
        setIsAdding(false);
        showToast('Smart rule added!');
    };

    const mapOpts = (items) => [
        { value: '', label: '-- None --' },
        ...items.map(i => ({ value: i.name, label: i.name }))
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-200">Smart Tagging Rules</h3>
                        <p className="text-xs text-gray-500">Auto-fill category, tag, mode when expense name matches</p>
                    </div>
                </div>
                <Button
                    onClick={() => setIsAdding(!isAdding)}
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                >
                    {isAdding ? 'Cancel' : <><Plus size={16} /> Add Rule</>}
                </Button>
            </div>

            {/* Add New Rule Form */}
            {isAdding && (
                <div className="glass-card p-4 space-y-4 animate-slide-up border border-purple-500/20">
                    <Input
                        label="Keyword to Match"
                        value={newRule.keyword}
                        onChange={(e) => setNewRule({ ...newRule, keyword: e.target.value })}
                        placeholder="e.g., Netflix, Uber, Swiggy"
                        className="bg-gray-900/50 border-gray-700"
                    />

                    <div className="grid grid-cols-2 gap-4">
                        <Select
                            label="Target Category"
                            value={newRule.targetCategory}
                            onChange={(e) => setNewRule({ ...newRule, targetCategory: e.target.value })}
                            options={mapOpts(categories)}
                            className="bg-gray-900/50 border-gray-700"
                        />
                        <Select
                            label="Target Tag"
                            value={newRule.targetTag}
                            onChange={(e) => setNewRule({ ...newRule, targetTag: e.target.value })}
                            options={mapOpts(tags)}
                            className="bg-gray-900/50 border-gray-700"
                        />
                        <Select
                            label="Target Mode"
                            value={newRule.targetMode}
                            onChange={(e) => setNewRule({ ...newRule, targetMode: e.target.value })}
                            options={mapOpts(modesOfPayment)}
                            className="bg-gray-900/50 border-gray-700"
                        />
                        <Select
                            label="Target Place"
                            value={newRule.targetPlace}
                            onChange={(e) => setNewRule({ ...newRule, targetPlace: e.target.value })}
                            options={mapOpts(places)}
                            className="bg-gray-900/50 border-gray-700"
                        />
                    </div>

                    <Button onClick={handleAdd} className="w-full bg-purple-600 hover:bg-purple-500 border-none">
                        Save Rule
                    </Button>
                </div>
            )}

            {/* Rules List */}
            <div className="space-y-2">
                {smartRules.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Sparkles size={32} className="mx-auto mb-2 opacity-20" />
                        <p className="text-sm">No smart rules yet</p>
                        <p className="text-xs">Add a rule to auto-tag your transactions</p>
                    </div>
                ) : (
                    smartRules.map((rule) => (
                        <div
                            key={rule.id}
                            className="glass-card p-4 flex items-center justify-between group hover:bg-white/10 transition-colors"
                        >
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                                        "{rule.keyword}"
                                    </span>
                                    <span className="text-gray-500">→</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {rule.targetCategory && (
                                        <span className="flex items-center gap-1 text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded">
                                            <Folder size={12} /> {rule.targetCategory}
                                        </span>
                                    )}
                                    {rule.targetTag && (
                                        <span className="flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded">
                                            <Tag size={12} /> {rule.targetTag}
                                        </span>
                                    )}
                                    {rule.targetMode && (
                                        <span className="flex items-center gap-1 text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded">
                                            <CreditCard size={12} /> {rule.targetMode}
                                        </span>
                                    )}
                                    {rule.targetPlace && (
                                        <span className="flex items-center gap-1 text-xs bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded">
                                            <MapPin size={12} /> {rule.targetPlace}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => deleteSmartRule(rule.id)}
                                className="p-2 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SmartRulesManager;
