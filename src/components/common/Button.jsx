import { twMerge } from 'tailwind-merge';

const Button = ({ children, variant = 'primary', className, style: customStyle, ...props }) => {
  const baseStyles = "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
    secondary: "border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow-sm",
    danger: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    ghost: "hover:bg-accent hover:text-accent-foreground"
  };

  // Use inline style for primary to use theme color with proper text contrast
  const getStyle = () => {
    return customStyle || {};
  };

  return (
    <button className={twMerge(baseStyles, variants[variant], className)} style={getStyle()} {...props}>
      {children}
    </button>
  );
};
export default Button;
