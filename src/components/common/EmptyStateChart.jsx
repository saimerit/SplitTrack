import { BarChart2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Empty state component for charts - displays when no data is available
 * Features ghost chart illustration and CTA to add transactions
 */
const EmptyStateChart = ({ onAddClick, title = "No transactions yet" }) => {
    const navigate = useNavigate();

    const handleAdd = () => {
        if (onAddClick) {
            onAddClick();
        } else {
            navigate('/add');
        }
    };

    return (
        <div className="flex flex-col items-center justify-center h-full py-8 px-4">
            {/* Ghost Chart SVG Illustration */}
            <div className="relative w-full max-w-[200px] h-32 mb-6 opacity-30">
                {/* Animated ghost bars */}
                <div className="absolute bottom-0 left-[10%] w-[15%] h-[40%] bg-linear-to-t from-gray-500/50 to-gray-400/20 rounded-t-md animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="absolute bottom-0 left-[30%] w-[15%] h-[70%] bg-linear-to-t from-gray-500/50 to-gray-400/20 rounded-t-md animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="absolute bottom-0 left-[50%] w-[15%] h-[50%] bg-linear-to-t from-gray-500/50 to-gray-400/20 rounded-t-md animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="absolute bottom-0 left-[70%] w-[15%] h-[85%] bg-linear-to-t from-gray-500/50 to-gray-400/20 rounded-t-md animate-pulse" style={{ animationDelay: '450ms' }} />

                {/* Ghost dashed line overlay */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 60" preserveAspectRatio="none">
                    <path
                        d="M 5 50 Q 25 30 45 35 T 85 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeDasharray="4 3"
                        className="text-gray-400/50"
                    />
                </svg>
            </div>

            {/* Icon */}
            <div className="p-3 bg-white/5 rounded-xl border border-white/10 mb-4">
                <BarChart2 size={24} className="text-gray-400" />
            </div>

            {/* Text */}
            <h4 className="text-gray-400 font-medium mb-1">{title}</h4>
            <p className="text-gray-500 text-sm text-center mb-5 max-w-[200px]">
                Add your first transaction to see insights here
            </p>

            {/* CTA Button */}
            <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-5 py-2.5 bg-linear-to-r from-sky-500 to-indigo-500 text-white text-sm font-medium rounded-full shadow-lg shadow-sky-500/25 hover:shadow-sky-500/40 hover:scale-105 transition-all duration-300"
            >
                <Plus size={16} />
                <span>Add Transaction</span>
            </button>
        </div>
    );
};

export default EmptyStateChart;
