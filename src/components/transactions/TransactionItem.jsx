import { useState } from 'react';
import { Trash2, Edit2, ChevronDown, ChevronRight, RefreshCw, 
  Utensils, ShoppingCart, Car, Zap, Smartphone, Plane, 
  IceCream, BookOpen, Coffee, Package, HandCoins 
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('settlement') || cat.includes('repayment') || cat.includes('refund')) return <HandCoins size={20} className="text-emerald-600" />;
  if (cat.includes('amazon') || cat.includes('delivery')) return <Package size={20} className="text-orange-600" />;
  if (cat.includes('coffee') || cat.includes('tea')) return <Coffee size={20} className="text-amber-700" />;
  if (cat.includes('dessert') || cat.includes('ice cream')) return <IceCream size={20} className="text-pink-500" />;
  if (cat.includes('stationary') || cat.includes('book')) return <BookOpen size={20} className="text-indigo-500" />;
  if (cat.includes('food')) return <Utensils size={20} className="text-orange-500" />;
  if (cat.includes('grocer')) return <ShoppingCart size={20} className="text-green-500" />;
  if (cat.includes('transport') || cat.includes('fuel')) return <Car size={20} className="text-blue-500" />;
  if (cat.includes('bill')) return <Zap size={20} className="text-yellow-500" />;
  if (cat.includes('shopping')) return <Smartphone size={20} className="text-purple-500" />;
  if (cat.includes('travel')) return <Plane size={20} className="text-sky-500" />;
  return <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />; 
};

const TransactionItem = ({ txn, linkedRefunds = [], participantsLookup, onEdit, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  
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
    // Changed: Flex-col on mobile, Row on sm+ screens
    <div className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-start hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors group">
      
      {/* Left Side: Icon & Details */}
      <div className="flex gap-3 flex-1 overflow-hidden">
        <div className="mt-1 shrink-0">
            {getCategoryIcon(txn.category)}
        </div>

        <div className="flex-1 min-w-0"> {/* min-w-0 forces truncation */}
            <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{txn.expenseName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            Paid by: <span className="font-medium">{payerName}</span> | {formatDate(txn.timestamp)}
            </p>
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
                            <RefreshCw size={12} className="mr-1" />
                            <span>{child.isReturn ? 'Settled' : 'Refund'}: {formatCurrency(Math.abs(child.amount))}</span>
                        </div>
                    ))}
                </div>
            )}

            <button onClick={() => setIsOpen(!isOpen)} className="mt-2 text-xs text-sky-600 hover:underline flex items-center gap-1">
            {isOpen ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            {isOpen ? 'Hide Details' : 'Show Details'}
            </button>

            {isOpen && (
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

      {/* Right Side: Amount & Actions */}
      {/* Changed: Adjusted margins and alignment for mobile */}
      <div className="flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-end mt-3 sm:mt-0 sm:ml-4 sm:text-right shrink-0">
        <div>
            <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{formatCurrency(amount)}</p>
            {shareText && <p className={`text-sm ${shareColor}`}>{shareText}</p>}
        </div>
        
        {/* Buttons: Visible on Mobile, Hover on Desktop */}
        <div className="flex gap-3 mt-0 sm:mt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(txn)} className="p-2 bg-gray-100 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:text-yellow-500 transition-colors" title="Edit">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(txn.id, txn.parentTransactionId)} className="p-2 bg-gray-100 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;