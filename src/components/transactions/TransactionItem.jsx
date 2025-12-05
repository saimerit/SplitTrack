import { useState } from 'react';
import { Trash2, Edit2, ChevronDown, ChevronRight, RefreshCw, ArrowDownLeft, ArrowUpRight, 
  Utensils, ShoppingCart, Car, Zap, Smartphone, Plane, 
  IceCream, BookOpen, Coffee, Package, HandCoins 
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

// Feature 6: Category Icon Mapping
const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();

  // 0. Settlements / Repayments
  if (cat.includes('settlement') || cat.includes('repayment') || cat.includes('settle') || cat.includes('payback') || cat.includes('refund') || cat.includes('return')) {
    return <HandCoins size={20} className="text-emerald-600" />;
  }

  // 0.5 Online Orders / Amazon
  if (cat.includes('amazon') || cat.includes('delivery') || cat.includes('courier') || cat.includes('flipkart') || cat.includes('package')) {
    return <Package size={20} className="text-orange-600" />;
  }

  // 1. Beverages (Unified - Coffee, Tea, Juice, Shakes, Water)
  if (cat.includes('coffee') || cat.includes('tea') || cat.includes('espresso') || cat.includes('latte') || 
      cat.includes('juice') || cat.includes('shake') || cat.includes('smoothie') || cat.includes('beverage') || 
      cat.includes('drink') || cat.includes('soda') || cat.includes('water') || cat.includes('cold')) {
    return <Coffee size={20} className="text-amber-700" />;
  }

  // 2. Desserts (Ice Cream, Sweets)
  if (cat.includes('dessert') || cat.includes('desert') || cat.includes('ice cream') || cat.includes('sweet') || cat.includes('cake') || cat.includes('chocolate')) {
    return <IceCream size={20} className="text-pink-500" />;
  }

  // 3. Education (Books, Courses)
  if (cat.includes('stationary') || cat.includes('course') || cat.includes('study') || cat.includes('education') || cat.includes('book') || cat.includes('tuition') || cat.includes('class') || cat.includes('college') || cat.includes('school')) {
    return <BookOpen size={20} className="text-indigo-500" />;
  }

  // 4. Standard Categories
  if (cat.includes('food') || cat.includes('dinner') || cat.includes('lunch') || cat.includes('breakfast') || cat.includes('snack')) return <Utensils size={20} className="text-orange-500" />;
  if (cat.includes('grocer') || cat.includes('mart') || cat.includes('store')) return <ShoppingCart size={20} className="text-green-500" />;
  if (cat.includes('transport') || cat.includes('fuel') || cat.includes('uber') || cat.includes('ola') || cat.includes('cab') || cat.includes('bus') || cat.includes('train')) return <Car size={20} className="text-blue-500" />;
  if (cat.includes('bill') || cat.includes('rent') || cat.includes('utilities') || cat.includes('recharge') || cat.includes('wifi')) return <Zap size={20} className="text-yellow-500" />;
  if (cat.includes('shopping') || cat.includes('clothes') || cat.includes('accessories') || cat.includes('electronics') || cat.includes('phone')) return <Smartphone size={20} className="text-purple-500" />;
  if (cat.includes('travel') || cat.includes('trip') || cat.includes('flight') || cat.includes('hotel') || cat.includes('vacation')) return <Plane size={20} className="text-sky-500" />;
  
  return <div className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700" />; // Default placeholder
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
    <div className="p-4 flex justify-between items-start hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors group">
      <div className="flex gap-3 flex-1">
        {/* Feature 6: Icon Display */}
        <div className="mt-1 shrink-0">
            {getCategoryIcon(txn.category)}
        </div>

        <div className="flex-1">
            <p className="font-semibold text-gray-800 dark:text-gray-200">{txn.expenseName}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
            Paid by: <span className="font-medium">{payerName}</span> | {formatDate(txn.timestamp)}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
            {txn.category} 
            {txn.modeOfPayment && <span className="text-blue-600 dark:text-blue-400 text-xs border border-blue-200 dark:border-blue-800 px-1 rounded">via {txn.modeOfPayment}</span>}
            {txn.place && ` at ${txn.place}`}
            {txn.tag && <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-full text-xs">{txn.tag}</span>}
            </p>
            
            {linkedRefunds.length > 0 && (
                <div className="mt-2 space-y-1">
                    {linkedRefunds.map(child => {
                        const childAmount = formatCurrency(Math.abs(child.amount));
                        const childDate = formatDate(child.timestamp);
                        
                        if (child.isReturn) {
                            return (
                                <div key={child.id} className="flex items-center text-xs text-indigo-600 dark:text-indigo-400">
                                    <RefreshCw size={12} className="mr-1" />
                                    <span>Settled in this transaction: {childAmount} on {childDate}</span>
                                </div>
                            );
                        } else {
                            return (
                                <div key={child.id} className="flex items-center text-xs text-green-600 dark:text-green-400">
                                    <RefreshCw size={12} className="mr-1" />
                                    <span>Refund: {childAmount} on {childDate}</span>
                                </div>
                            );
                        }
                    })}
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

      <div className="text-right shrink-0 ml-4">
        <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{formatCurrency(amount)}</p>
        {shareText && <p className={`text-sm ${shareColor}`}>{shareText}</p>}
        
        <div className="flex gap-3 justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(txn)} className="text-gray-400 hover:text-yellow-500 transition-colors" title="Edit">
            <Edit2 size={16} />
          </button>
          <button onClick={() => onDelete(txn.id, txn.parentTransactionId)} className="text-gray-400 hover:text-red-500 transition-colors" title="Delete">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;