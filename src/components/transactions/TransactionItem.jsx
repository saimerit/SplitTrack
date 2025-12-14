import { useState, useEffect } from 'react';
import {
  Trash2, Edit2, X, RefreshCw, ChevronRight, ChevronDown, Copy, CheckCircle, Circle,
  Utensils, ShoppingCart, Car, Zap, Smartphone, Plane,
  IceCream, BookOpen, Coffee, Package, HandCoins, Calendar, MapPin, Tag, Cookie
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();

  // Repayment, Return, Settlement -> HandCoins
  if (cat.includes('settlement') || cat.includes('repayment') || cat.includes('refund') || cat.includes('return'))
    return <HandCoins size={20} className="text-emerald-600" />;

  // Beverages, Drinks, Coffee -> Coffee
  if (cat.includes('coffee') || cat.includes('tea') || cat.includes('beverage') || cat.includes('drink'))
    return <Coffee size={20} className="text-amber-700" />;

  // Desserts, Sweets, Ice Cream -> IceCream
  if (cat.includes('dessert') || cat.includes('desert') || cat.includes('ice cream') || cat.includes('sweet'))
    return <IceCream size={20} className="text-pink-500" />;

  // Snacks, Chips -> Cookie
  if (cat.includes('snack') || cat.includes('chip') || cat.includes('biscuit') || cat.includes('cookie'))
    return <Cookie size={20} className="text-orange-400" />;

  // Courses, Education, Books -> BookOpen
  if (cat.includes('stationary') || cat.includes('book') || cat.includes('course') || cat.includes('education'))
    return <BookOpen size={20} className="text-indigo-500" />;

  // Amazon, Delivery -> Package
  if (cat.includes('amazon') || cat.includes('delivery'))
    return <Package size={20} className="text-orange-600" />;

  // General Food -> Utensils
  if (cat.includes('food'))
    return <Utensils size={20} className="text-orange-500" />;

  // Groceries -> ShoppingCart
  if (cat.includes('grocer'))
    return <ShoppingCart size={20} className="text-green-500" />;

  // Transport, Fuel -> Car
  if (cat.includes('transport') || cat.includes('fuel'))
    return <Car size={20} className="text-blue-500" />;

  // Bills, Utilities -> Zap
  if (cat.includes('bill') || cat.includes('recharge'))
    return <Zap size={20} className="text-yellow-500" />;

  // Shopping -> Smartphone
  if (cat.includes('shopping') || cat.includes('cloth'))
    return <Smartphone size={20} className="text-purple-500" />;

  // Travel -> Plane
  if (cat.includes('travel') || cat.includes('trip'))
    return <Plane size={20} className="text-sky-500" />;

  // Default
  return <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />;
};

const TransactionItem = ({ txn, linkedRefunds = [], participantsLookup, onEdit, onDelete, selectionMode, isSelected, onToggleSelect, onClone }) => {
  // Mobile Modal State
  const [showModal, setShowModal] = useState(false);
  // Desktop Inline Expansion State
  const [isExpanded, setIsExpanded] = useState(false);

  // Lock body scroll when mobile modal is open
  useEffect(() => {
    if (showModal) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [showModal]);

  const getName = (uid) => {
    if (uid === 'me') return 'You';
    return participantsLookup.get(uid)?.name || uid;
  };

  const payerName = getName(txn.payer);
  const myShare = txn.splits?.me || 0;
  const amount = txn.amount;

  let shareText = '';
  let shareColor = 'text-gray-600 dark:text-gray-400';

  if (txn.isReturn) {
    const recipientId = txn.participants[0];
    const recipientName = getName(recipientId);
    if (txn.payer === 'me') {
      shareText = `You repaid ${recipientName}`;
      shareColor = 'text-red-600 font-medium';
    } else if (recipientId === 'me') {
      shareText = `${payerName} repaid you`;
      shareColor = 'text-green-600 font-medium';
    }
  } else if (myShare > 0) {
    if (txn.payer === 'me') {
      const amountIPaidForOthers = amount - myShare;
      if (amountIPaidForOthers > 1) {
        shareText = `You lent ${formatCurrency(amountIPaidForOthers)}`;
        shareColor = 'text-green-600 font-medium';
      } else {
        shareText = `You paid ${formatCurrency(myShare)}`;
        shareColor = 'text-gray-500 dark:text-gray-400';
      }
    } else {
      shareText = `You owe ${formatCurrency(myShare)}`;
      shareColor = 'text-red-600 font-medium';
    }
  }

  return (
    <>
      {/* ================= MOBILE VIEW ================= */}
      {/* List Item (Truncated) */}
      <div
        onClick={() => selectionMode ? onToggleSelect(txn.id) : setShowModal(true)}
        className={`sm:hidden p-3 flex flex-row justify-between items-center border-b border-gray-100 dark:border-gray-700 transition-colors cursor-pointer group ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
      >
        <div className="flex gap-3 items-center min-w-0 flex-1">
          {selectionMode && (
            <div className="shrink-0 mr-2 text-indigo-600 dark:text-indigo-400">
              {isSelected ? <CheckCircle size={22} className="fill-indigo-100 dark:fill-indigo-900" /> : <Circle size={22} className="text-gray-300 dark:text-gray-600" />}
            </div>
          )}
          <div className="shrink-0">{getCategoryIcon(txn.category)}</div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-800 dark:text-gray-200 truncate pr-2">{txn.expenseName}</p>
            <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 truncate">
              <span className="truncate max-w-20">{payerName}</span>
              <span>•</span>
              <span className="truncate">{txn.category || 'General'}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0 ml-2 flex flex-col items-end">
          <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(amount)}</p>
          {shareText && <p className={`text-[10px] ${shareColor}`}>{shareText}</p>}
        </div>
        <ChevronRight size={16} className="text-gray-300 dark:text-gray-600 ml-2 shrink-0" />
      </div>

      {/* Full Page Modal (Mobile Only) */}
      {showModal && (
        <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center sm:p-6 animate-fade-in sm:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)}></div>
          <div className="relative w-full h-[95vh] bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">

            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-start bg-gray-50/50 dark:bg-gray-700/30 shrink-0">
              <div className="pr-4">
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-snug wrap-break-word">{txn.expenseName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2"><Calendar size={14} /> {formatDate(txn.timestamp)}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors shrink-0"><X size={20} className="text-gray-600 dark:text-gray-300" /></button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              <div className="flex items-center justify-between p-4 bg-sky-50 dark:bg-sky-900/20 rounded-xl border border-sky-100 dark:border-sky-800">
                <span className="text-sm font-medium text-sky-800 dark:text-sky-300">Total Amount</span>
                <span className="text-3xl font-bold text-sky-700 dark:text-sky-400">{formatCurrency(txn.amount)}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Paid By</span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">{payerName}</span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <span className="text-xs text-gray-500 uppercase font-bold block mb-1">Category</span>
                  <div className="flex items-center gap-2">{getCategoryIcon(txn.category)}<span className="font-medium text-gray-800 dark:text-gray-200">{txn.category || 'Uncategorized'}</span></div>
                </div>
                {txn.place && <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg col-span-2 flex items-center gap-2"><MapPin size={16} className="text-gray-400" /><span className="font-medium text-gray-800 dark:text-gray-200">{txn.place}</span></div>}
                {txn.tag && <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg col-span-2 flex items-center gap-2"><Tag size={16} className="text-gray-400" /><span className="font-medium text-gray-800 dark:text-gray-200">{txn.tag}</span></div>}
              </div>

              {txn.description && <div><h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Description</h4><p className="text-gray-700 dark:text-gray-300 text-sm bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-100 dark:border-gray-700 italic">"{txn.description}"</p></div>}

              {txn.splits && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Split Details</h4>
                  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg divide-y divide-gray-100 dark:divide-gray-700">
                    {Object.entries(txn.splits).map(([uid, val]) => {
                      if (val === 0) return null;
                      return (<div key={uid} className="flex justify-between items-center p-3 text-sm"><span className="text-gray-600 dark:text-gray-300 font-medium">{getName(uid)}</span><span className="font-mono text-gray-800 dark:text-gray-200">{formatCurrency(val)}</span></div>);
                    })}
                  </div>
                </div>
              )}

              {linkedRefunds.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Related Transactions</h4>
                  <div className="space-y-2">
                    {linkedRefunds.map(child => (
                      <div key={child.id} className="flex items-center justify-between p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800 text-sm">
                        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300"><RefreshCw size={14} /><span>{child.isReturn ? 'Settlement' : 'Refund'}</span></div>
                        <span className="font-bold text-indigo-700 dark:text-indigo-300">{formatCurrency(Math.abs(child.amount))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex gap-3 shrink-0 safe-area-pb">
              <button onClick={(e) => { e.stopPropagation(); setShowModal(false); onEdit(txn); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 font-semibold shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"><Edit2 size={18} /> Edit</button>
              <button onClick={(e) => { e.stopPropagation(); setShowModal(false); onDelete(txn.id, txn.parentTransactionId); }} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"><Trash2 size={18} /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DESKTOP VIEW ================= */}
      {/* Original Style (Restored) */}
      <div className={`hidden sm:flex p-4 flex-row justify-between items-start border-b border-gray-100 dark:border-gray-700 transition-colors group ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
        <div className="flex gap-3 flex-1 overflow-hidden">
          {selectionMode && (
            <div className="shrink-0 mt-2 mr-2 cursor-pointer text-indigo-600 dark:text-indigo-400" onClick={() => onToggleSelect(txn.id)}>
              {isSelected ? <CheckCircle size={20} className="fill-indigo-100 dark:fill-indigo-900" /> : <Circle size={20} className="text-gray-300 dark:text-gray-600" />}
            </div>
          )}
          <div className="mt-1 shrink-0">{getCategoryIcon(txn.category)}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{txn.expenseName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">Paid by: <span className="font-medium">{payerName}</span> | {formatDate(txn.timestamp)}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex flex-wrap items-center gap-2">
              {txn.category}
              {txn.modeOfPayment && <span className="text-blue-600 dark:text-blue-400 text-xs border border-blue-200 dark:border-blue-800 px-1 rounded">via {txn.modeOfPayment}</span>}
              {txn.place && ` at ${txn.place}`}
              {txn.tag && <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-full text-xs">{txn.tag}</span>}
            </p>

            {linkedRefunds.length > 0 && (
              <div className="mt-2 space-y-1">
                {linkedRefunds.map(child => (
                  <div key={child.id} className="flex items-center text-xs text-indigo-600 dark:text-indigo-400">
                    <RefreshCw size={12} className="mr-1" /><span>{child.isReturn ? 'Settled' : 'Refund'}: {formatCurrency(Math.abs(child.amount))}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setIsExpanded(!isExpanded)} className="mt-2 text-xs text-sky-600 hover:underline flex items-center gap-1">
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />} {isExpanded ? 'Hide Details' : 'Show Details'}
            </button>

            {isExpanded && (
              <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1 animate-fade-in">
                {txn.description && <p className="italic border-l-2 border-gray-300 pl-2 mb-2">"{txn.description}"</p>}
                {txn.splits && Object.entries(txn.splits).map(([uid, val]) => {
                  if (val === 0) return null;
                  return <p key={uid}>• {getName(uid)}: {formatCurrency(val)}</p>;
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end ml-4 text-right shrink-0">
          <div>
            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{formatCurrency(amount)}</p>
            {shareText && <p className={`text-sm ${shareColor}`}>{shareText}</p>}
          </div>

          <div className="flex gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onClone(txn)} className="p-2 bg-gray-100 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:text-indigo-600 transition-colors" title="Clone"><Copy size={16} /></button>
            <button onClick={() => onEdit(txn)} className="p-2 bg-gray-100 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:text-yellow-500 transition-colors" title="Edit"><Edit2 size={16} /></button>
            <button onClick={() => onDelete(txn.id, txn.parentTransactionId)} className="p-2 bg-gray-100 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors" title="Delete"><Trash2 size={16} /></button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TransactionItem;