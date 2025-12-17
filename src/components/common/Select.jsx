const Select = ({ label, options, value, onChange, error, className, ...props }) => (
  <div className={className}>
    {label && <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="block w-full px-4 py-3 border border-white/10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-gray-200"
      style={{ backgroundColor: 'var(--bg-surface)' }}
      {...props}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ backgroundColor: 'var(--bg-surface)' }}>
          {opt.label}
        </option>
      ))}
    </select>
    {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
  </div>
);

export default Select;