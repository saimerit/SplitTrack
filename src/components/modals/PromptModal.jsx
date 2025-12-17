import { useState } from 'react';
import Button from '../common/Button';

// 1. Internal Child Component
// This holds the form state. It only exists when the modal is OPEN.
// When it mounts, 'useState' initializes with the current 'defaultValue'.
const PromptFormContent = ({
  title,
  label,
  defaultValue,
  placeholder,
  onConfirm,
  onCancel,
  confirmText,
  inputType
}) => {
  const [value, setValue] = useState(defaultValue || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirm(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/50 backdrop-blur-sm">
      <div className="p-6 rounded-lg shadow-xl w-96 border border-white/10 animate-scale-in" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <h3 className="text-xl font-semibold text-gray-100 mb-4">{title}</h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            {label && (
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {label}
              </label>
            )}
            <input
              type={inputType}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="block w-full px-4 py-3 border border-white/10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 text-white"
              style={{ backgroundColor: 'var(--bg-main)' }}
              placeholder={placeholder}
              autoFocus
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!value.trim()}>
              {confirmText}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Parent Wrapper
// Handles the visibility logic.
const PromptModal = (props) => {
  // If closed, render nothing. This unmounts PromptFormContent and clears its state.
  if (!props.isOpen) return null;

  // If open, render the content. This mounts a FRESH instance with reset state.
  return <PromptFormContent {...props} />;
};

export default PromptModal;