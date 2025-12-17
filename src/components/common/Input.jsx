import { useEffect, useRef } from 'react';

const Input = ({ label, error, className = '', ...props }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    const handleWheel = (e) => {
      // Strictly prevent the wheel from changing the number value
      if (props.type === 'number') {
        e.preventDefault();
        e.target.blur(); // Remove focus to stop further scrolling interaction
      }
    };

    const input = inputRef.current;
    if (input && props.type === 'number') {
      // passive: false allows us to use preventDefault() to stop the value change
      input.addEventListener('wheel', handleWheel, { passive: false });
    }

    return () => {
      if (input && props.type === 'number') {
        input.removeEventListener('wheel', handleWheel);
      }
    };
  }, [props.type]);

  return (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-gray-400 mb-1">{label}</label>}
      <input
        ref={inputRef}
        className={`
          w-full px-4 py-2 rounded-lg border text-gray-100
          focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:ring-red-500' : 'border-white/10'}
          ${className}
        `}
        style={{ backgroundColor: 'var(--bg-surface)' }}
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};
export default Input;