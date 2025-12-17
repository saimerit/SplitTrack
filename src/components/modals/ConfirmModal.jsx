import { useState } from 'react';
import Button from '../common/Button';

const ConfirmModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  confirmInputRequired = null
}) => {
  const [inputValue, setInputValue] = useState('');

  // FIX: Removed the useEffect. 
  // We now clear the input manually in the handlers below.

  if (!isOpen) return null;

  // Disable button if specific input is required but not matched
  const isButtonDisabled = confirmInputRequired && inputValue !== confirmInputRequired;

  // Wrapper to clear input when cancelling
  const handleCancel = () => {
    setInputValue('');
    onCancel();
  };

  // Wrapper to clear input when confirming
  const handleConfirm = () => {
    onConfirm();
    setInputValue('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/50 backdrop-blur-sm">
      <div className="p-6 rounded-lg shadow-xl w-96 border border-white/10 animate-scale-in" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <h3 className="text-xl font-semibold text-gray-100">{title}</h3>

        <div
          className="text-sm text-gray-400 mt-2 mb-4"
          dangerouslySetInnerHTML={{ __html: message }}
        ></div>

        {/* Logic to use confirmInputRequired */}
        {confirmInputRequired && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Type <span className="font-bold text-red-500">{confirmInputRequired}</span> to confirm:
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="block w-full px-3 py-2 border border-white/10 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-white"
              style={{ backgroundColor: 'var(--bg-main)' }}
              placeholder={confirmInputRequired}
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isButtonDisabled}
            className={isButtonDisabled ? "opacity-50 cursor-not-allowed" : ""}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;