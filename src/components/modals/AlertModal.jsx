import Button from '../common/Button';

const AlertModal = ({
  isOpen,
  title,
  message,
  onConfirm,
  confirmText = "OK",
  variant = "primary" // 'primary' | 'danger'
}) => {
  if (!isOpen) return null;

  // Determine title color based on variant
  const titleColor = variant === 'danger'
    ? 'text-red-600 dark:text-red-500'
    : 'text-gray-900 dark:text-gray-100';

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center bg-black/50 backdrop-blur-sm">
      <div className="p-6 rounded-lg shadow-xl w-96 border border-white/10 animate-scale-in" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <h3 className={`text-xl font-semibold mb-2 ${titleColor}`}>
          {title}
        </h3>

        <div className="text-sm text-gray-400 mb-6">
          {message}
        </div>

        <div className="flex justify-end">
          <Button variant={variant} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;