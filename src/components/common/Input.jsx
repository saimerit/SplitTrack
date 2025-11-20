const Input = ({ label, error, className, ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
    <input 
      className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
      {...props} 
    />
    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
  </div>
);
export default Input;