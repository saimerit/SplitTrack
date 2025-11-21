import { useState } from 'react';
import { Trash2, Edit2, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { formatCurrency, formatDate } from '../../utils/formatters';

const TransactionItem = ({ txn, linkedRefunds = [], participantsLookup, onEdit, onDelete }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const payerName = txn.payer === 'me' ? 'You (me)' : (participantsLookup.get(txn.payer)?.name || txn.payer);
  const myShare = txn.splits?.me || 0;
  const amount = txn.amount;

  let shareText = '';
  let shareColor = 'text-gray-600 dark:text-gray-400';
  
  if (txn.isReturn) {
    const recipientId = txn.participants[0];
    const recipientName = recipientId === 'me' ? 'You (me)' : (participantsLookup.get(recipientId)?.name || recipientId);
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
    <div className="p-4 flex justify-between items-start hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors">
      <div className="flex-1">
        <p className="font-semibold text-gray-800 dark:text-gray-200">{txn.expenseName}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Paid by: <span className="font-medium">{payerName}</span> | {formatDate(txn.timestamp)}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {txn.category} 
          {txn.modeOfPayment && <span className="text-blue-600 dark:text-blue-400 ml-1">via {txn.modeOfPayment}</span>}
          {txn.place && ` at ${txn.place}`}
          {txn.tag && <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-600 rounded-full text-xs">{txn.tag}</span>}
        </p>
        
        {/* Linked Refunds (Children) */}
        {linkedRefunds.length > 0 && (
            <div className="mt-2 space-y-1">
                {linkedRefunds.map(child => (
                    <div key={child.id} className="flex items-center text-xs text-green-600 dark:text-green-400">
                        <RefreshCw size={12} className="mr-1" />
                        <span>Refund received: {formatCurrency(Math.abs(child.amount))} on {formatDate(child.timestamp)}</span>
                    </div>
                ))}
            </div>
        )}

        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="mt-2 text-sm text-sky-600 hover:underline flex items-center gap-1"
        >
          {isOpen ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
          {isOpen ? 'Hide Details' : 'Show Details'}
        </button>

        {isOpen && (
          <div className="mt-2 ml-4 text-sm text-gray-600 dark:text-gray-400 space-y-1 animate-fade-in">
            {txn.description && <p className="italic">"{txn.description}"</p>}
            {txn.splits && Object.entries(txn.splits).map(([uid, val]) => {
              if (val === 0) return null;
              const name = participantsLookup.get(uid)?.name || uid;
              return <p key={uid}>• {name}: {formatCurrency(val)}</p>;
            })}
          </div>
        )}
      </div>

      <div className="text-right shrink-0 ml-4">
        <p className="font-bold text-lg text-gray-800 dark:text-gray-200">{formatCurrency(amount)}</p>
        {shareText && <p className={`text-sm ${shareColor}`}>{shareText}</p>}
        
        <div className="flex gap-3 justify-end mt-2">
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