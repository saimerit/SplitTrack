import { useLocation } from 'react-router-dom';
import TransactionForm from '../components/transactions/TransactionForm';

const AddTransaction = () => {
  const location = useLocation();
  const initialData = location.state; // Capture data passed from History
  const isEditMode = initialData?.isEditMode || false;

  // Use 'key' to force re-mount when switching between Add/Edit or different transactions
  // Added location.key to ensure form resets even when navigating to the same route
  const formKey = (initialData ? initialData.id : 'new-transaction') + (location.key || '');

  return (
    <div className="max-w-7xl mx-auto px-4">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">
        {isEditMode ? 'Edit Transaction' : 'Add New Transaction'}
      </h2>
      <TransactionForm 
        key={formKey} 
        initialData={initialData} 
        isEditMode={isEditMode} 
      />
    </div>
  );
};

export default AddTransaction;