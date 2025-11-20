const Toast = ({ message, isError = false }) => {
  return (
    <div 
      className={`fixed bottom-5 right-5 z-50 px-6 py-4 rounded-lg shadow-lg text-white transition-all duration-300 animate-fade-in-up ${
        isError ? 'bg-red-500' : 'bg-green-500'
      }`}
    >
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default Toast;