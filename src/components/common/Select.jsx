const Select = ({ label, options, value, onChange, error, className, ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="block w-full px-4 py-3 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} className={opt.className || "dark:bg-gray-700 dark:text-gray-200"}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
  </div>
);

export default Select;