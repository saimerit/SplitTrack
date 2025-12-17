import { twMerge } from 'tailwind-merge';

const Button = ({ children, variant = 'primary', className, style: customStyle, ...props }) => {
  const baseStyles = "flex items-center px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50";

  const variants = {
    primary: "hover:opacity-90 focus:ring-sky-500",
    secondary: "text-gray-200 border border-white/10 hover:bg-white/5",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
    ghost: "text-gray-400 hover:text-gray-200"
  };

  // Use inline style for primary to use theme color with proper text contrast
  const getStyle = () => {
    if (variant === 'primary') {
      return { backgroundColor: 'var(--primary)', color: 'var(--primary-text)', ...customStyle };
    }
    if (variant === 'secondary') {
      return { backgroundColor: 'var(--bg-surface)', ...customStyle };
    }
    return customStyle || {};
  };

  return (
    <button className={twMerge(baseStyles, variants[variant], className)} style={getStyle()} {...props}>
      {children}
    </button>
  );
};
export default Button;