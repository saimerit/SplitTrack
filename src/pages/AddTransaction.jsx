import TransactionForm from '../components/transactions/TransactionForm';

const AddTransaction = () => {
  return (
    <div className="max-w-7xl mx-auto px-4">
      <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-6">
        Add New Transaction
      </h2>
      <TransactionForm />
    </div>
  );
};

export default AddTransaction;