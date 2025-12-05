import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Timestamp, addDoc, collection } from 'firebase/firestore'; 
import { db } from '../../config/firebase'; 
import useAppStore from '../../store/useAppStore';
import { addTransaction, updateTransaction } from '../../services/transactionService';
import { validateSplits } from '../../utils/validators';
import { formatCurrency } from '../../utils/formatters';
import { Trash2, RefreshCw, HandCoins, Filter, Sparkles, Layers, ChevronDown, ArrowRightLeft } from 'lucide-react';
import Fuse from 'fuse.js';

import Input from '../common/Input';
import Button from '../common/Button';
import Select from '../common/Select';
import SplitAllocator from './SplitAllocator';
import ParticipantSelector from './ParticipantSelector';
import ConfirmModal from '../modals/ConfirmModal';
import PromptModal from '../modals/PromptModal';
import SuccessAnimation from '../common/SuccessAnimation';

// --- HELPERS ---

const getTxnTime = (txn) => {
    if (!txn?.timestamp) return 0;
    return txn.timestamp.toMillis ? txn.timestamp.toMillis() : new Date(txn.timestamp).getTime();
};

const generateSmartName = (links, subTypeStr) => {
    if (!links || links.length === 0) return "";
    const prefix = (subTypeStr === 'settlement') ? "Settlement" : "Refund";
    return `${prefix}: ` + links.map(t => t.name).join(', ');
};

// --- SEARCHABLE SELECT COMPONENT ---
const SearchableSelect = ({ label, value, onChange, options, placeholder, className, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);
    const [query, setQuery] = useState("");

    // FIX: Sync query with external value changes (e.g., when parent clears selection)
    useEffect(() => {
        Promise.resolve().then(() => {
            if (!value) {
                setQuery("");
            } else {
                const selected = options.find(o => o.value === value);
                if (selected) setQuery(selected.label);
            }
        });
    }, [value, options]);

    const filteredOptions = useMemo(() => {
        if (!query) return options;
        const lowerQuery = query.toLowerCase();
        // If query exactly matches selected value, show all
        const selected = options.find(o => o.value === value);
        if (selected && selected.label.toLowerCase() === lowerQuery) return options;
        
        return options.filter(opt => 
            opt.label.toLowerCase().includes(lowerQuery)
        );
    }, [query, options, value]);

    const handleSelect = (option) => {
        onChange({ target: { value: option.value, option: option } }); 
        setQuery(option.label);
        setIsOpen(false);
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                // On blur, reset query to match value if exists, else clear
                const selected = options.find(o => o.value === value);
                if (selected) setQuery(selected.label);
                else if (!value) setQuery('');
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, value, options]);

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                    onFocus={() => setIsOpen(true)}
                    placeholder={placeholder || "Select..."}
                    disabled={disabled}
                    className="block w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
                    <ChevronDown size={16} />
                </div>
            </div>
            
            {isOpen && !disabled && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.length > 0 ? (
                        filteredOptions.map((opt, idx) => (
                            <div
                                key={opt.value || idx}
                                onClick={() => handleSelect(opt)}
                                className={`px-4 py-2 cursor-pointer text-sm ${opt.className || ''} ${
                                    opt.value === value 
                                    ? 'bg-sky-100 dark:bg-sky-900 text-sky-700 dark:text-sky-200 font-medium' 
                                    : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                            >
                                {opt.label}
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No matches found</div>
                    )}
                </div>
            )}
        </div>
    );
};

const TransactionForm = ({ initialData = null, isEditMode = false }) => {
  const navigate = useNavigate();
  const { 
    categories, places, tags, modesOfPayment, 
    rawParticipants, rawTransactions, groups, 
    userSettings, showToast, activeGroupId 
  } = useAppStore();
  
  const wasMeIncluded = initialData?.splits ? (initialData.splits['me'] !== undefined) : true;

  // State for Success Animation
  const [showSuccess, setShowSuccess] = useState(false);

  // --- 1. GROUP LOGIC ---
  const [formGroupId, setFormGroupId] = useState(initialData?.groupId || activeGroupId || 'personal');

  // --- 2. DATA SELECTORS ---
  const allParticipants = useMemo(() => [...rawParticipants], [rawParticipants]);

  const groupTransactions = useMemo(() => {
      return rawTransactions.filter(t => (t.groupId || 'personal') === formGroupId && !t.isDeleted);
  }, [rawTransactions, formGroupId]);

  const participantsLookup = useMemo(() => {
      const map = new Map();
      map.set('me', { name: 'You (me)', uniqueId: 'me' });
      allParticipants.forEach(p => map.set(p.uniqueId, p));
      return map;
  }, [allParticipants]);

  const getName = useCallback(
        (uid) => {
            if (uid === 'me') return 'You';
            return participantsLookup.get(uid)?.name || uid;
        },
        [participantsLookup]
    );

  const getTxnDateStr = useCallback((txn) => {
        if (!txn?.timestamp) return '';
        const d = txn.timestamp.toDate ? txn.timestamp.toDate() : new Date(txn.timestamp);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    }, []);

  // --- MEMOIZED OPTIONS ---
  const generateOptions = (items, collectionName, label) => [
      { value: "", label: "-- Select --" }, 
      ...items.map(i => ({ value: i.name, label: i.name })),
      { value: `add_new_${collectionName}`, label: `+ Add New ${label}`, className: "text-sky-600 font-bold bg-sky-50 dark:bg-gray-700 dark:text-sky-400" }
  ];

  const categoryOptions = useMemo(() => generateOptions(categories, 'categories', 'Category'), [categories]);
  const placeOptions = useMemo(() => generateOptions(places, 'places', 'Place'), [places]);
  const tagOptions = useMemo(() => generateOptions(tags, 'tags', 'Tag'), [tags]);
  const modeOptions = useMemo(() => generateOptions(modesOfPayment, 'modesOfPayment', 'Mode'), [modesOfPayment]);
  
  const payerOptions = useMemo(() => [{ value: "me", label: "You (me)" }, ...allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [allParticipants]);
  const recipientOptions = useMemo(() => [{ value: "me", label: "You (me)" }, ...allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [allParticipants]);
  const debtorOptions = useMemo(() => [{ value: '', label: '-- Show All --' }, ...allParticipants.map(p => ({ value: p.uniqueId, label: p.name }))], [allParticipants]);

  // --- INIT FORM STATE ---
  const getInitialType = () => {
      if (initialData?.isReturn) return 'refund';
      if (initialData && initialData.amount < 0) return 'refund';
      return initialData?.type || 'expense';
  };

  const getInitialSubType = () => {
      if (initialData?.isReturn) return 'settlement';
      return 'product'; 
  };

  const [type, setType] = useState(getInitialType());
  const [refundSubType, setRefundSubType] = useState(getInitialSubType()); 

  const isRefundTab = type === 'refund';
  const isSettlement = isRefundTab && refundSubType === 'settlement'; 
  const isProductRefund = isRefundTab && refundSubType === 'product'; 
  const isIncome = type === 'income';

  const [name, setName] = useState(initialData?.expenseName || '');
  const [amount, setAmount] = useState(initialData ? (Math.abs(initialData.amount)/100).toFixed(2) : '');
  
  const getInitialDate = () => {
      try {
          if (initialData?.timestamp) {
              let d;
              if (typeof initialData.timestamp.toDate === 'function') d = initialData.timestamp.toDate();
              else if (initialData.timestamp.seconds) d = new Date(initialData.timestamp.seconds * 1000);
              else d = new Date(initialData.timestamp);
              if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
          }
      } catch (e) { console.warn("Date parsing error:", e); }
      return new Date().toISOString().split('T')[0];
  };

  const [date, setDate] = useState(getInitialDate());
  const [category, setCategory] = useState(initialData?.category || userSettings.defaultCategory || '');
  const [place, setPlace] = useState(initialData?.place || userSettings.defaultPlace || '');
  const [tag, setTag] = useState(initialData?.tag || userSettings.defaultTag || '');
  const [mode, setMode] = useState(initialData?.modeOfPayment || userSettings.defaultMode || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [payer, setPayer] = useState(initialData?.payer || 'me');
  const [selectedParticipants, setSelectedParticipants] = useState(initialData?.participants || []);
  
  const [linkedTxns, setLinkedTxns] = useState([]); 
  const [tempSelectId, setTempSelectId] = useState(''); 
  const [repaymentFilter, setRepaymentFilter] = useState(''); 
  const hasInitializedLinks = useRef(false);
  
  const [splitMethod, setSplitMethod] = useState(initialData?.splitMethod || 'equal');
  const [splits, setSplits] = useState(initialData?.splits || {}); 
  const [includeMe, setIncludeMe] = useState(wasMeIncluded);
  
  const [includePayer, setIncludePayer] = useState(false);
  const [showDupeModal, setShowDupeModal] = useState(false);
  const [dupeTxn, setDupeTxn] = useState(null);
  const [activePrompt, setActivePrompt] = useState(null); 
  
  const [suggestion, setSuggestion] = useState(null);

  const handlePayerChange = (newPayer) => {
      setPayer(newPayer);
      if (isSettlement && selectedParticipants[0] === newPayer) {
          setSelectedParticipants([]);
      }
  };

  const handleRecipientChange = (newRecipient) => {
      if (!newRecipient) {
          setSelectedParticipants([]);
          return;
      }
      if (isSettlement && newRecipient === payer) {
          setSelectedParticipants([]);
          return;
      }
      setSelectedParticipants([newRecipient]);
  };

  // --- SMART FEATURES ---
  useEffect(() => {
        if (isEditMode || !name || name.length < 3) {
            if (suggestion !== null) Promise.resolve().then(() => setSuggestion(null));
            return;
        }
        const timer = setTimeout(() => {
            const fuse = new Fuse(groupTransactions.slice(0, 500), { keys: ['expenseName'], threshold: 0.3 });
            const result = fuse.search(name);
            if (result.length > 0) {
                const bestMatch = result[0].item;
                if ((!category && bestMatch.category) || (!place && bestMatch.place) || (!tag && bestMatch.tag)) {
                    setSuggestion(bestMatch);
                } else {
                    Promise.resolve().then(() => setSuggestion(null));
                }
            } else {
                Promise.resolve().then(() => setSuggestion(null));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [name, isEditMode, groupTransactions, category, place, tag, suggestion]);

  const applySuggestion = () => {
      if (!suggestion) return;
      if (suggestion.category && !category) setCategory(suggestion.category);
      if (suggestion.place && !place) setPlace(suggestion.place);
      if (suggestion.tag && !tag) setTag(suggestion.tag);
      setSuggestion(null);
      showToast("Autofilled details!");
  };

  // --- AUTO SET PAYER/RECIPIENT ---
  useEffect(() => {
      if (!isEditMode || !initialData) return;
      const initialPayer = initialData.payer || 'me';
      const shouldInclude = initialPayer !== 'me' && initialData.splits && initialData.splits[initialPayer] !== undefined;
      if (shouldInclude) Promise.resolve().then(() => setIncludePayer(true));   
  }, [isEditMode, initialData]);
  
  useEffect(() => {
      if (payer === 'me') Promise.resolve().then(() => setIncludePayer(false));   
  }, [payer]);

  const updateSmartName = (links, subTypeStr) => {
      const smartName = generateSmartName(links, subTypeStr);
      if (!smartName) return;
      if (!name || name.startsWith("Refund:") || name.startsWith("Settlement:") || name.startsWith("Repayment:")) {
          setName(smartName);
      }
  };

  // --- OUTSTANDING DEBT CALCULATION ---
  const getOutstandingDebt = useCallback((parentTxn, debtorId) => {
      let debt = parentTxn.splits?.[debtorId] || 0;
      const related = groupTransactions.filter(t => {
          if (isEditMode && t.id === initialData?.id) return false;
          if (t.parentTransactionId === parentTxn.id) return true;
          if (t.parentTransactionIds && t.parentTransactionIds.includes(parentTxn.id)) return true;
          return false;
      });
      related.forEach(rel => {
          if (rel.isReturn) {
              const link = rel.linkedTransactions?.find(l => l.id === parentTxn.id);
              if (link) {
                  if (rel.payer === debtorId) debt -= Math.abs(link.amount);
                  else if (rel.payer !== debtorId && link.amount < 0) debt -= Math.abs(link.amount);
              } else if (rel.payer === debtorId && (!rel.linkedTransactions || rel.linkedTransactions.length === 0)) {
                  debt -= Math.abs(rel.amount);
              }
          } else if (rel.amount < 0) {
              let refundShare = rel.splits?.[debtorId] || 0;
              debt += refundShare;
          }
      });
      return Math.max(0, debt);
  }, [groupTransactions, isEditMode, initialData]);

  // --- LINKING LOGIC ---
  useEffect(() => {
      hasInitializedLinks.current = false;
  }, [initialData?.id]);

  useEffect(() => {
      if (hasInitializedLinks.current || groupTransactions.length === 0) return;
      let linksToSet = [];
      let shouldUpdate = false;
      if (initialData && initialData.linkedTransactions) {
          linksToSet = initialData.linkedTransactions.map(link => {
              const original = groupTransactions.find(t => t.id === link.id) || rawTransactions.find(t => t.id === link.id);
              const full = original ? Math.abs(original.amount) : 0;
              
              // FIX: Handle negative amounts for Product Refunds (UI expects positive)
              let allocVal = link.amount;
              if (initialData.amount < 0 && !initialData.isReturn) {
                  allocVal = Math.abs(allocVal);
              }

              return {
                  id: link.id,
                  name: original ? original.expenseName : 'Unknown',
                  dateStr: getTxnDateStr(original),
                  timestamp: getTxnTime(original),
                  fullAmount: full,
                  maxAllocatable: full, 
                  allocated: (allocVal / 100).toFixed(2),
                  // Attempt to reconstruct relation type if editing
                  relationType: (original && original.payer !== 'me' && original.splits?.['me']) ? 'owed_by_me' : 'owed_to_me' 
              };
          });
          shouldUpdate = true;
      }
      if (shouldUpdate) {
          setTimeout(() => {
              setLinkedTxns(linksToSet);
              const currentSubType = initialData?.isReturn ? 'settlement' : 'product';
              const smartName = generateSmartName(linksToSet, currentSubType);
              if (!initialData?.expenseName) setName(smartName);
              hasInitializedLinks.current = true;
          }, 0);
      }
  }, [initialData, groupTransactions, rawTransactions, getTxnDateStr]);

  const eligibleParents = useMemo(() => {
    if (!isSettlement) {
        // --- CHANGED: Calculate remaining refundable amount for Product Refunds ---
        return groupTransactions
            .filter(t => t.amount > 0 && !t.isReturn)
            .filter(t => !linkedTxns.some(l => l.id === t.id))
            .map(t => {
                const remaining = t.netAmount !== undefined ? t.netAmount : t.amount;
                return { ...t, remainingRefundable: remaining };
            })
            .filter(t => t.remainingRefundable > 0) // Hide fully refunded
            .sort((a, b) => getTxnTime(b) - getTxnTime(a));
    }
    
    // owed_by_me: I owe Someone. 
    // owed_to_me: Someone owes Me.
    const debtsIOwe = groupTransactions.filter(t => !t.isReturn && t.payer !== 'me' && t.splits?.['me'] > 0)
        .map(t => ({ ...t, relationType: 'owed_by_me', counterParty: t.payer, outstanding: getOutstandingDebt(t, 'me') }));
        
    const debtsTheyOwe = groupTransactions.filter(t => !t.isReturn && t.payer === 'me' && Object.keys(t.splits || {}).some(uid => uid !== 'me' && t.splits[uid] > 0))
        .flatMap(t => {
            return Object.keys(t.splits).filter(uid => uid !== 'me' && t.splits[uid] > 0).map(uid => ({
                ...t, relationType: 'owed_to_me', counterParty: uid, outstanding: getOutstandingDebt(t, uid)
            }));
    });
    
    let all = [...debtsIOwe, ...debtsTheyOwe];
    
    if (repaymentFilter) {
        all = all.filter(t => t.counterParty === repaymentFilter);
    } else {
        const targetPerson = payer === 'me' ? selectedParticipants[0] : payer;
        if (targetPerson && targetPerson !== 'me') {
            all = all.filter(t => t.counterParty === targetPerson);
        }
    }

    const result = all.filter(t => t.outstanding > 10).filter(t => !linkedTxns.some(l => l.id === t.id)).sort((a, b) => getTxnTime(b) - getTxnTime(a));
    return [...new Map(result.map(item => [item.id, item])).values()];
  }, [groupTransactions, linkedTxns, isSettlement, payer, selectedParticipants, repaymentFilter, getOutstandingDebt]);

  // --- COLOR CODING LOGIC ---
  const linkableOptions = useMemo(() => {
    return [
        { value: '', label: '-- Select Expense to Link --' },
        ...eligibleParents.map(t => {
            // --- CHANGED: Handle Product Refund Labels (Neutral) vs Settlement Labels (Debts) ---
            if (!isSettlement) {
                return {
                    value: t.id,
                    label: `${t.expenseName} (Refundable: ₹${(t.remainingRefundable / 100).toFixed(2)}) - ${getTxnDateStr(t)}`,
                    className: 'text-gray-800 dark:text-gray-200',
                    data: t
                };
            }

            const isOwedToMe = t.relationType === 'owed_to_me';
            const sign = isOwedToMe ? '+' : '-';
            const colorClass = isOwedToMe
                ? 'text-green-600 dark:text-green-400 font-medium' 
                : 'text-red-600 dark:text-red-400 font-medium';    

            const prefix = isOwedToMe
                ? `[${getName(t.counterParty)} owes You] `
                : `[You owe ${getName(t.counterParty)}] `;

            return {
                value: t.id,
                label: `${prefix}${t.expenseName} (${sign}₹${(t.outstanding / 100).toFixed(2)}) - ${getTxnDateStr(t)}`,
                className: colorClass,
                data: t
            };
        }),
    ];
  }, [eligibleParents, getName, getTxnDateStr, isSettlement]);

  const showIncludePayerCheckbox = payer !== 'me' && !selectedParticipants.includes(payer);
  
  const splitAllocatorParticipants = useMemo(() => [
      ...(includeMe ? [{ uniqueId: 'me', name: 'You' }] : []),
      ...(showIncludePayerCheckbox && includePayer ? (() => { const p = allParticipants.find(x => x.uniqueId === payer); return p ? [p] : []; })() : []),
      ...allParticipants.filter(p => selectedParticipants.includes(p.uniqueId))
  ], [includeMe, showIncludePayerCheckbox, includePayer, payer, allParticipants, selectedParticipants]);

  const validation = useMemo(() => {
    if (isIncome || isSettlement) return { isValid: true, message: '' };
    const amountInRupees = parseFloat(amount);
    if (isNaN(amountInRupees) || amountInRupees === 0) return splitMethod === 'dynamic' ? { isValid: false, message: 'Enter a total amount first.' } : { isValid: true, message: '' };
    const amountInPaise = Math.round(amountInRupees * 100);
    return validateSplits(amountInPaise, splits, splitMethod);
  }, [amount, splits, splitMethod, isIncome, isSettlement]);

  const autoUpdateTotal = (currentLinks) => {
      const total = currentLinks.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0);
      if (total < 0) {
          handleFlipDirection(Math.abs(total), currentLinks);
      } else {
          setAmount(total.toFixed(2));
      }
  };

  const handleFlipDirection = (newPositiveAmount, currentLinks) => {
      if (!isSettlement) return;
      
      const oldPayer = payer;
      const oldRecipient = selectedParticipants[0];
      
      if (!oldRecipient || oldRecipient === oldPayer) return; 

      setPayer(oldRecipient);
      setSelectedParticipants([oldPayer]);
      
      const invertedLinks = currentLinks.map(l => ({
          ...l,
          allocated: (parseFloat(l.allocated) * -1).toFixed(2)
      }));
      
      setLinkedTxns(invertedLinks);
      setAmount(newPositiveAmount.toFixed(2));
      showToast("Direction swapped based on net total!", false);
  };

  const handleAmountChange = (e) => {
      const val = e.target.value;
      setAmount(val);
      // Auto-sync link allocation for single product refunds to support partial refunds (charges deducted)
      if (isProductRefund && linkedTxns.length === 1) {
          setLinkedTxns(prev => prev.map(t => ({ ...t, allocated: val })));
      }
  };

  const addLinkedTxn = (e) => {
      const pid = e.target.value;
      if (!pid) return;
      
      const selectedOption = linkableOptions.find(o => o.value === pid);
      const parent = selectedOption?.data;

      if (parent) {
           // --- CHANGED: Explicit Logic Handling for Product Refund vs Settlement ---
           
           let allocValue = 0;
           let newLink = null;

           if (!isSettlement) {
               // --- PRODUCT REFUND LOGIC ---
               // 1. Value defaults to remaining refundable (net)
               allocValue = (parent.remainingRefundable || parent.amount) / 100;
               setAmount(allocValue.toFixed(2));

               // 2. Auto-fill Payer (Refund goes to original Payer)
               if (parent.payer) setPayer(parent.payer);

               // 3. Auto-populate Participants & Splits from Parent
               const parentSplits = parent.splits || {};
               const involvedIDs = Object.keys(parentSplits);
               const newSelected = involvedIDs.filter(id => id !== 'me');
               setSelectedParticipants(newSelected); // Everyone except Me (Me handled by includeMe)

               // 4. Convert Splits to Percentage (To support partial refund scaling)
               if (parent.splitMethod === 'equal') {
                   setSplitMethod('equal');
                   setSplits({});
               } else {
                   const totalParent = Math.abs(parent.amount);
                   const newSplits = {};
                   involvedIDs.forEach(id => {
                       const share = parentSplits[id];
                       const percent = (share / totalParent) * 100;
                       newSplits[id] = percent; 
                   });
                   setSplitMethod('percentage');
                   setSplits(newSplits);
               }

               // 5. Handle "Include Me" and "Include Payer"
               setIncludeMe(involvedIDs.includes('me'));
               if (parent.payer !== 'me') {
                   setIncludePayer(involvedIDs.includes(parent.payer));
               }

               newLink = {
                   id: parent.id, 
                   name: parent.expenseName, 
                   dateStr: getTxnDateStr(parent), 
                   timestamp: getTxnTime(parent),
                   fullAmount: Math.abs(parent.amount), 
                   maxAllocatable: parent.remainingRefundable || parent.amount, 
                   allocated: allocValue.toFixed(2), 
                   relationType: 'product_refund' 
               };
               
               // For product refund, we usually just link one item
               setLinkedTxns([newLink]);
               updateSmartName([newLink], refundSubType);

           } else {
               // --- SETTLEMENT LOGIC (Existing) ---
               if (payer === 'me' && selectedParticipants.length === 0) {
                    const inferred = parent.counterParty;
                    if (inferred && inferred !== 'me') setSelectedParticipants([inferred]);
                    if (!repaymentFilter) setRepaymentFilter(inferred);
               }

               const outstandingRupees = parent.outstanding / 100;
               const isMyDebt = parent.relationType === 'owed_by_me'; 
               
               if (payer === 'me') {
                   allocValue = isMyDebt ? outstandingRupees : -outstandingRupees;
               } else {
                   allocValue = isMyDebt ? -outstandingRupees : outstandingRupees;
               }

               const currentTotal = parseFloat(amount) || 0;
               let newTotal = currentTotal + allocValue;
               
               let shouldFlip = false;
               if (newTotal < 0) {
                   shouldFlip = true;
                   newTotal = Math.abs(newTotal);
               }

               newLink = {
                   id: parent.id, 
                   name: parent.expenseName, 
                   dateStr: getTxnDateStr(parent), 
                   timestamp: getTxnTime(parent),
                   fullAmount: Math.abs(parent.amount), 
                   maxAllocatable: parent.outstanding, 
                   allocated: allocValue.toFixed(2), 
                   relationType: parent.relationType 
               };

               let updatedLinks = [...linkedTxns, newLink];

               if (shouldFlip) {
                   handleFlipDirection(newTotal, updatedLinks);
               } else {
                   setLinkedTxns(updatedLinks);
                   setAmount(newTotal.toFixed(2));
               }
               
               updateSmartName(updatedLinks, refundSubType);
           }
      }
      setTempSelectId(''); // Clear the select immediately
  };

  const removeLinkedTxn = (id) => { 
      const updatedLinks = linkedTxns.filter(t => t.id !== id); 
      setLinkedTxns(updatedLinks); 
      if (isSettlement) autoUpdateTotal(updatedLinks); 
      updateSmartName(updatedLinks, refundSubType); 
  };
  
  const updateLinkedAllocation = (id, val) => { 
      const updatedLinks = linkedTxns.map(t => t.id === id ? { ...t, allocated: val } : t); 
      setLinkedTxns(updatedLinks); 
      if (isSettlement) autoUpdateTotal(updatedLinks); 
  };
  
  const handleSubTypeChange = (newType) => { setRefundSubType(newType); setLinkedTxns([]); setAmount(''); setName(''); };
  const totalAllocated = linkedTxns.reduce((sum, t) => sum + (parseFloat(t.allocated) || 0), 0);
  const formAmount = parseFloat(amount) || 0;
  const allocationDiff = formAmount - totalAllocated;
  const isAllocationValid = Math.abs(allocationDiff) < 0.05;

  const handleQuickAddRequest = (value, collectionName, label) => {
    if (value === `add_new_${collectionName}`) {
        setActivePrompt({ type: 'quickAdd', targetCollection: collectionName, targetLabel: label, title: `Add New ${label}`, label: `New ${label} Name` });
    } else {
        if(collectionName === 'categories') setCategory(value);
        if(collectionName === 'places') setPlace(value);
        if(collectionName === 'tags') setTag(value);
        if(collectionName === 'modesOfPayment') setMode(value);
    }
  };

  const handleTemplateSaveRequest = () => { setActivePrompt({ type: 'template', title: 'Save as Template', label: 'Template Name' }); };
  const handleCancel = () => navigate(-1);
  const resetForm = () => { setName(''); setAmount(''); setLinkedTxns([]); setSplits({}); setIncludeMe(true); setIncludePayer(false); setDescription(''); setSuggestion(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const executeTemplateSave = async (templateName) => {
    const amountInRupees = parseFloat(amount);
    const multiplier = isProductRefund ? -1 : 1;
    const finalAmount = !isNaN(amountInRupees) ? Math.round(amountInRupees * 100) * multiplier : null;
    const templateData = {
        name: templateName, expenseName: name, amount: finalAmount, 
        type: isSettlement ? 'expense' : type, category, place, tag, modeOfPayment: mode, description,
        payer: isIncome ? 'me' : payer, isReturn: isSettlement, 
        participants: isIncome ? [] : (isSettlement ? [selectedParticipants[0]] : selectedParticipants),
        splitMethod: (isSettlement || isIncome) ? 'none' : splitMethod, splits: (isSettlement || isIncome) ? {} : splits,
        groupId: formGroupId 
    };
    try { await addDoc(collection(db, 'ledgers/main-ledger/templates'), templateData); showToast("Template saved successfully!"); } catch (error) { console.error(error); showToast("Failed to save template.", true); }
  };

  const handlePromptConfirm = async (inputValue) => {
      if (!inputValue) return;
      const { type: promptType, targetCollection, targetLabel } = activePrompt || {};
      if (promptType === 'quickAdd') {
          try {
              await addDoc(collection(db, `ledgers/main-ledger/${targetCollection}`), { name: inputValue });
              showToast(`${targetLabel} added!`);
              if(targetCollection === 'categories') setCategory(inputValue);
              if(targetCollection === 'places') setPlace(inputValue);
              if(targetCollection === 'tags') setTag(inputValue);
              if(targetCollection === 'modesOfPayment') setMode(inputValue);
          } catch (e) { console.error(e); showToast(`Failed to add ${targetLabel}.`, true); }
      } else if (promptType === 'template') { await executeTemplateSave(inputValue); }
      setActivePrompt(null);
  };

  const saveTransaction = async () => {
       const amountInPaise = Math.round(parseFloat(amount) * 100);
       const multiplier = isProductRefund ? -1 : 1;
       const finalAmount = amountInPaise * multiplier;
       let safeParticipants = selectedParticipants;
       if (isSettlement && (!selectedParticipants || selectedParticipants.length === 0)) safeParticipants = ['me'];
       if (showIncludePayerCheckbox && includePayer) safeParticipants = [...safeParticipants, payer];

       let finalSplits = { ...splits }; 
       if (!isSettlement && !isIncome && splitMethod === 'equal') {
           const involvedCount = splitAllocatorParticipants.length;
           if (involvedCount > 0) {
               const absAmount = Math.abs(amountInPaise);
               const share = Math.floor(absAmount / involvedCount);
               const remainder = absAmount % involvedCount;
               finalSplits = {}; 
               splitAllocatorParticipants.forEach((p, index) => {
                   let val = share;
                   if (index < remainder) val += 1;
                   finalSplits[p.uniqueId] = val * multiplier;
               });
           }
       } else {
           Object.keys(finalSplits).forEach(key => {
               if (splitMethod === 'percentage') {
                   const percent = finalSplits[key];
                   const share = Math.round((percent / 100) * Math.abs(amountInPaise));
                   finalSplits[key] = share * multiplier;
               } else {
                   finalSplits[key] = finalSplits[key] * multiplier;
               }
           });
       }

       const linkedTransactionsData = linkedTxns.map(t => ({ id: t.id, amount: Math.round(parseFloat(t.allocated) * 100) * multiplier }));
       const parentIds = linkedTransactionsData.map(t => t.id);

       const txnData = {
         expenseName: name, amount: finalAmount, type: isSettlement ? 'expense' : type, 
         category: category.startsWith('add_new') ? '' : category, 
         place: place.startsWith('add_new') ? '' : place, 
         tag: tag.startsWith('add_new') ? '' : tag,
         modeOfPayment: mode.startsWith('add_new') ? '' : mode, 
         description, timestamp: Timestamp.fromDate(new Date(date)), 
         payer: isIncome ? 'me' : payer, isReturn: isSettlement, 
         participants: isIncome ? [] : (isSettlement ? [safeParticipants[0]] : safeParticipants),
         splitMethod: (isSettlement || isIncome) ? 'none' : splitMethod,
         splits: (isSettlement || isIncome) ? {} : finalSplits,
         linkedTransactions: linkedTransactionsData, parentTransactionIds: parentIds,
         parentTransactionId: parentIds.length > 0 ? parentIds[0] : null, isLinkedRefund: parentIds.length > 0,
         groupId: formGroupId 
       };

       try {
         if (isEditMode) {
            await updateTransaction(initialData.id, txnData, initialData.parentTransactionId);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                navigate('/history');
            }, 1200);
         } else {
            await addTransaction(txnData);
            setShowSuccess(true);
            setTimeout(() => {
                setShowSuccess(false);
                resetForm();
                navigate('/history');
            }, 1200);
         }
       } catch(e) { console.error(e); showToast("Error saving: " + e.message, true); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountInRupees = parseFloat(amount);
    if (!name || isNaN(amountInRupees)) { showToast("Please enter valid name and amount", true); return; }
    if (!isSettlement && !isIncome && !validation.isValid) { showToast(validation.message || "Please fix split errors.", true); return; }
    if (isProductRefund && linkedTxns.length > 0) {
        for (const link of linkedTxns) {
            const allocatedPaise = Math.round(parseFloat(link.allocated) * 100);
            if (allocatedPaise > link.fullAmount) { showToast(`Refund for "${link.name}" cannot exceed original amount (${formatCurrency(link.fullAmount)}).`, true); return; }
        }
    }
    // Only check allocation exact match for settlements or if strict matching is desired for refunds
    // For product refunds, we just want to ensure we don't refund MORE than the original. 
    // Partial refunds are allowed, but the allocation should probably sum to the refund amount if multiple items are selected?
    // Current logic: If 1 item linked, they must match.
    if ((isProductRefund || isSettlement) && linkedTxns.length > 0 && !isAllocationValid) { showToast(`Allocated total does not match transaction amount. Difference: ${formatCurrency(allocationDiff * 100)}`, true); return; }

    if (!isEditMode) {
        const checkAmount = Math.round(amountInRupees * 100);
        const potentialDupe = groupTransactions.find(t => {
            if (!t.timestamp) return false;
            const tDate = t.timestamp.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            if (isNaN(tDate.getTime())) return false;
            return Math.abs(t.amount) === checkAmount && t.expenseName === name && tDate.toISOString().split('T')[0] === date;
        });
        if (potentialDupe) { setDupeTxn(potentialDupe); setShowDupeModal(true); return; }
    }
    saveTransaction();
  };

  const forceSubmit = async () => { setShowDupeModal(false); saveTransaction(); };
  
  const handleParticipantAdd = (uid) => setSelectedParticipants([...selectedParticipants, uid]);
  const handleParticipantRemove = (uid) => setSelectedParticipants(selectedParticipants.filter(x => x !== uid));

  const handleManualSwap = () => {
      const oldPayer = payer;
      const oldRecipient = selectedParticipants[0];
      if(oldPayer && oldRecipient && oldRecipient !== oldPayer) {
          setPayer(oldRecipient);
          setSelectedParticipants([oldPayer]);
          const invertedLinks = linkedTxns.map(l => ({ ...l, allocated: (parseFloat(l.allocated) * -1).toFixed(2) }));
          setLinkedTxns(invertedLinks);
      }
  };

  return (
    <>
    {showSuccess && <SuccessAnimation message={isEditMode ? "Transaction Updated!" : "Transaction Logged!"} />}
    <form onSubmit={handleSubmit} className="max-w-7xl mx-auto bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      
      <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-sky-50 dark:bg-sky-900/10 p-3 rounded-lg border border-sky-100 dark:border-sky-900 mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
              <Layers className="text-sky-600 dark:text-sky-400" size={20} />
              <div className="flex flex-col">
                  <span className="text-xs font-bold text-sky-700 dark:text-sky-300 uppercase">Space</span>
                  <select 
                    value={formGroupId}
                    onChange={(e) => {
                        setFormGroupId(e.target.value);
                        setLinkedTxns([]); 
                    }}
                    className="bg-transparent font-medium text-gray-800 dark:text-gray-200 focus:outline-none cursor-pointer"
                  >
                      <option value="personal">Personal</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
              </div>
          </div>
          {isEditMode && initialData.groupId !== formGroupId && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Warning: You are moving this transaction</span>
          )}
      </div>

      <div className="col-span-1 md:col-span-2 lg:col-span-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Type</label>
        <div className="flex flex-col sm:flex-row gap-4">
          {['expense', 'income', 'refund'].map(t => (
            <label key={t} className="flex-1 cursor-pointer group">
              <input type="radio" name="txnType" value={t} checked={type === t} onChange={() => setType(t)} className="peer sr-only" />
              <div className={`
                text-center py-3 rounded-lg border transition-all font-medium capitalize
                ${type === t 
                  ? (t === 'expense' ? 'bg-red-50 text-red-700 border-red-500 dark:bg-red-900/20 dark:text-red-400' : 
                     t === 'income' ? 'bg-blue-50 text-blue-700 border-blue-500 dark:bg-blue-900/20 dark:text-blue-400' : 
                     'bg-green-50 text-green-700 border-green-500 dark:bg-green-900/20 dark:text-green-400')
                  : 'border-gray-300 text-gray-600 dark:border-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}
              `}>
                {t === 'expense' ? 'Expense (Out)' : t === 'income' ? 'Income (In)' : 'Refund / Repayment'}
              </div>
            </label>
          ))}
        </div>
      </div>

      {isRefundTab && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">What kind of return is this?</label>
              <div className="flex gap-4">
                  <button type="button" onClick={() => handleSubTypeChange('product')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm border transition-colors ${isProductRefund ? 'bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                      <RefreshCw size={16} /> Product Refund
                  </button>
                  <button type="button" onClick={() => handleSubTypeChange('settlement')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm border transition-colors ${isSettlement ? 'bg-purple-100 border-purple-500 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
                      <HandCoins size={16} /> Peer Settlement
                  </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">{isProductRefund ? "Use this when you return an item and get money back (Negative Expense)." : "Use this when paying back a friend to settle debts (Repayment)."}</p>
          </div>
      )}

      <div className="col-span-1 md:col-span-2 lg:col-span-4 relative">
        <Input label="Expense Name" value={name} onChange={e => setName(e.target.value)} required placeholder={isSettlement ? "Repayment" : "e.g. Dinner at Taj"} />
        {suggestion && (
            <div onClick={applySuggestion} className="absolute z-10 top-[70px] left-0 right-0 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 shadow-lg cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors flex items-center gap-3 animate-fade-in">
                <Sparkles size={18} className="text-indigo-600 dark:text-indigo-400" />
                <div className="text-sm text-indigo-900 dark:text-indigo-200"><span className="font-bold">Suggestion found:</span> {suggestion.category} • {suggestion.place} • {suggestion.tag}</div>
            </div>
        )}
      </div>

      <div className="col-span-1 md:col-span-1 lg:col-span-2">
         {!isIncome && (
            <SearchableSelect 
                label={isSettlement ? "Who is paying?" : (isProductRefund ? "Who received the refund?" : "Who paid?")} 
                value={payer} 
                onChange={e => handlePayerChange(e.target.value)} 
                options={payerOptions} 
                placeholder="Search payer..."
            />
         )}
      </div>
      
      {isSettlement && (
         <div className="col-span-1 md:col-span-1 lg:col-span-2 flex items-end gap-2">
             <div className="flex-1">
                <SearchableSelect 
                    label="Who is being repaid?" 
                    value={selectedParticipants[0] || ''} 
                    onChange={e => handleRecipientChange(e.target.value)} 
                    options={recipientOptions} 
                    placeholder="Search recipient..."
                />
             </div>
             <button type="button" onClick={handleManualSwap} className="p-3 mb-px bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors" title="Swap Payer and Recipient">
                 <ArrowRightLeft size={18} className="text-gray-600 dark:text-gray-300" />
             </button>
         </div>
      )}

      {(isProductRefund || isSettlement) && (
          <div className="col-span-1 md:col-span-2 lg:col-span-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800">
                {isSettlement && (
                    <div className="mb-4">
                        <label className="text-xs font-bold text-blue-800 dark:text-blue-300 uppercase mb-1 flex items-center gap-2"><Filter size={12} /> Filter by Debtor (Show Debts)</label>
                        <SearchableSelect 
                            value={repaymentFilter} 
                            onChange={e => { setRepaymentFilter(e.target.value); setLinkedTxns([]); setAmount(''); }} 
                            options={debtorOptions} 
                            placeholder="Filter by debtor..."
                            className="w-full md:w-1/2" 
                        />
                        <p className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">Select a person to see expenses involving them.</p>
                    </div>
                )}
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link to Original Expense(s)</label>
                <SearchableSelect 
                    value={tempSelectId} 
                    onChange={addLinkedTxn} 
                    options={linkableOptions} 
                    placeholder="Type to search transaction..."
                />
                
                {linkedTxns.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {linkedTxns.map((link) => {
                            // Determine Color Class based on relationType stored
                            let nameColor = 'text-gray-800 dark:text-gray-200';
                            let boxBorder = 'border-gray-300';
                            let boxText = 'text-gray-800';
                            let bgColor = 'bg-white dark:bg-gray-800';

                            if (link.relationType !== 'product_refund') {
                                const isOwedToMe = link.relationType === 'owed_to_me';
                                nameColor = isOwedToMe ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
                                const isAllocNegative = parseFloat(link.allocated) < 0;
                                boxBorder = isAllocNegative ? 'border-green-300' : 'border-red-300';
                                boxText = isAllocNegative ? 'text-green-600' : 'text-red-600';
                                bgColor = isOwedToMe ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
                            } else {
                                // Product Refund Styling
                                nameColor = 'text-blue-700 dark:text-blue-300';
                                bgColor = 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800';
                                boxBorder = 'border-blue-300';
                                boxText = 'text-blue-700';
                            }

                            return (
                                <div key={link.id} className={`flex items-center gap-2 p-2 rounded border ${bgColor}`}>
                                    <span className={`text-sm flex-1 truncate font-medium ${nameColor}`} title={link.name}>
                                        {link.name} <span className="text-xs opacity-75 text-gray-500 dark:text-gray-400">({formatCurrency(link.maxAllocatable)})</span>
                                    </span>
                                    <span className={`text-sm text-gray-500`}>{parseFloat(link.allocated) < 0 ? 'Offset: ' : 'Ref: '}₹</span>
                                    <input type="number" value={link.allocated} onChange={(e) => updateLinkedAllocation(link.id, e.target.value)} className={`w-24 px-1 py-1 text-sm border rounded dark:bg-gray-700 dark:text-white dark:border-gray-600 ${boxText} ${boxBorder}`} step="0.01" />
                                    <button type="button" onClick={() => removeLinkedTxn(link.id)} className="text-gray-400 hover:text-red-500 p-1 rounded"><Trash2 size={14} /></button>
                                </div>
                            );
                        })}
                        <div className={`text-xs font-medium flex justify-between ${Math.abs(allocationDiff) < 0.05 ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                            <span>Total Allocated: {formatCurrency(totalAllocated * 100)}</span>
                            <span>{Math.abs(allocationDiff) < 0.05 ? "✓ Matches Total" : `${formatCurrency(Math.abs(allocationDiff)*100)} ${allocationDiff > 0 ? 'Remaining' : 'Exceeded'}`}</span>
                        </div>
                    </div>
                )}
              </div>
          </div>
      )}

      <Input label="Amount (₹)" type="number" step="0.01" value={amount} onChange={handleAmountChange} required className="col-span-1" />
      <Input label="Date" type="date" value={date} onChange={e => setDate(e.target.value)} required className="col-span-1" />
      <SearchableSelect label="Category" value={category} onChange={e => handleQuickAddRequest(e.target.value, 'categories', 'Category')} options={categoryOptions} className="col-span-1" placeholder="Search category..." />
      <SearchableSelect label="Place" value={place} onChange={e => handleQuickAddRequest(e.target.value, 'places', 'Place')} options={placeOptions} className="col-span-1" placeholder="Search place..." />
      <SearchableSelect label="Tag" value={tag} onChange={e => handleQuickAddRequest(e.target.value, 'tags', 'Tag')} options={tagOptions} className="col-span-1" placeholder="Search tag..." />
      <SearchableSelect label="Mode" value={mode} onChange={e => handleQuickAddRequest(e.target.value, 'modesOfPayment', 'Mode')} options={modeOptions} className="col-span-1" placeholder="Search mode..." />
      <Input label="Description (Optional)" value={description} onChange={e => setDescription(e.target.value)} className="col-span-1 md:col-span-2 lg:col-span-2" placeholder="Short notes..." />

      {(type === 'expense' || isProductRefund) && (
         <div className="col-span-1 md:col-span-2 lg:col-span-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-6">
             <div className="flex items-center">
                <input type="checkbox" id="includeMe" checked={includeMe} onChange={e => setIncludeMe(e.target.checked)} className="h-5 w-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500" />
                <label htmlFor="includeMe" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include <strong>Me</strong> in this split?</label>
            </div>
            {showIncludePayerCheckbox && (
                 <div className="flex items-center bg-sky-50 border border-sky-200 rounded-lg px-3 py-1 dark:bg-sky-900 dark:border-sky-700">
                    <input type="checkbox" id="includePayer" checked={includePayer} onChange={e => setIncludePayer(e.target.checked)} className="h-5 w-5 text-sky-600 border-gray-300 rounded focus:ring-sky-500" />
                    <label htmlFor="includePayer" className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Include Payer in split?</label>
                </div>
            )}
         </div>
      )}

      {!isIncome && !isSettlement && (
         <>
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4 border-t sm:border-t-0 pt-4 sm:pt-0 border-gray-200 dark:border-gray-700">
                <ParticipantSelector 
                    selectedIds={selectedParticipants} 
                    onAdd={handleParticipantAdd} 
                    onRemove={handleParticipantRemove} 
                />
            </div>
            <div className="col-span-1 md:col-span-2 lg:col-span-2 space-y-4">
               <Select label="Split Method" value={splitMethod} onChange={(e) => setSplitMethod(e.target.value)} options={[{ value: 'equal', label: '1. Equal Split' }, { value: 'percentage', label: '2. Percentage Split' }, { value: 'dynamic', label: '3. Dynamic (Manual) Split' }]} />
               <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                   <SplitAllocator method={splitMethod} participants={splitAllocatorParticipants} totalAmount={Math.round(parseFloat(amount || 0) * 100)} splits={splits} onSplitChange={setSplits} />
                   {validation.message && (
                      <div className={`mt-3 p-2 rounded text-sm font-medium flex items-center gap-2 ${validation.isValid ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'}`}>
                          <span>{validation.isValid ? '✓' : '⚠️'}</span>{validation.message.replace(/^✓ /, '')}
                      </div>
                   )}
               </div>
            </div>
         </>
      )}

      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col sm:flex-row gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
         {!isEditMode && <Button type="button" variant="secondary" onClick={handleTemplateSaveRequest} className="flex-1 py-3">Save as Template</Button>}
         {isEditMode && <Button type="button" variant="secondary" onClick={handleCancel} className="flex-1 py-3">Cancel</Button>}
         <Button type="submit" className={`flex-1 sm:grow-2 py-3 text-lg shadow-md ${isEditMode ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-sky-600 hover:bg-sky-700'}`}>
            {isEditMode ? 'Update Transaction' : 'Log Transaction'}
         </Button>
      </div>
    </form>
    <ConfirmModal isOpen={showDupeModal} title="Possible Duplicate" message={`Found similar transaction: <strong>${dupeTxn?.expenseName}</strong> (${dupeTxn?.amount/100}). Add anyway?`} confirmText="Add Anyway" onConfirm={forceSubmit} onCancel={() => setShowDupeModal(false)} />
    <PromptModal isOpen={!!activePrompt} title={activePrompt?.title || ''} label={activePrompt?.label || ''} onConfirm={handlePromptConfirm} onCancel={() => setActivePrompt(null)} confirmText="Save" />
    </>
  );
};

export default TransactionForm;