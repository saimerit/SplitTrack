import { useEffect, useRef, useState } from 'react';

/**
 * Input Component with optional floating label and icon prefix
 * Supports all standard input types
 */
const Input = ({ label, error, className = '', icon: Icon, floatingLabel = false, ...props }) => {
  const inputRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = props.value && props.value.toString().length > 0;

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

  const showFloatingLabel = floatingLabel && (isFocused || hasValue);

  return (
    <div className="w-full">
      {/* Standard label (when not floating) */}
      {label && !floatingLabel && (
        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        {/* Icon Prefix */}
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Icon size={18} />
          </div>
        )}

        {/* Floating Label */}
        {floatingLabel && label && (
          <label
            className={`
              absolute left-${Icon ? '10' : '4'} transition-all duration-200 pointer-events-none
              ${showFloatingLabel
                ? 'top-1 text-[10px] font-bold text-sky-500 uppercase tracking-wider'
                : 'top-1/2 -translate-y-1/2 text-sm text-gray-400'
              }
            `}
          >
            {label}
          </label>
        )}

        <input
          ref={inputRef}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`
            w-full px-4 py-3 rounded-xl border text-gray-100
            focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/50 outline-none transition-all
            disabled:opacity-50 disabled:cursor-not-allowed
            ${Icon ? 'pl-10' : ''}
            ${floatingLabel && showFloatingLabel ? 'pt-5 pb-1' : ''}
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-white/10'}
            ${className}
          `}
          style={{ backgroundColor: 'var(--bg-surface)' }}
          {...props}
        />
      </div>

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};

export default Input;
