import { CheckCircle } from 'lucide-react';

const SuccessAnimation = ({ message = "Success!" }) => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="p-8 rounded-full shadow-2xl mb-4 transform transition-all animate-scale-in" style={{ backgroundColor: 'var(--bg-surface)' }}>
        <CheckCircle size={64} className="text-green-500 animate-draw-check" />
      </div>
      <h3 className="text-2xl font-bold text-gray-200 animate-slide-up">
        {message}
      </h3>
    </div>
  );
};

export default SuccessAnimation;