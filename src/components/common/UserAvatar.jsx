/**
 * UserAvatar - Initials-based avatar component
 * Generates consistent color from user ID/name hash
 */
const UserAvatar = ({ name, uniqueId, size = 'md', className = '' }) => {
    // Get initials from name (max 2 chars)
    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(' ').filter(Boolean);
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.slice(0, 2).toUpperCase();
    };

    // Generate consistent color based on uniqueId or name
    const getColor = (id) => {
        const colors = [
            { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30' },
            { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30' },
            { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
            { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
            { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
            { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30' },
            { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30' },
            { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30' },
        ];

        // Simple hash from ID
        const str = id || name || 'default';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    };

    const sizes = {
        sm: 'w-6 h-6 text-[10px]',
        md: 'w-8 h-8 text-xs',
        lg: 'w-10 h-10 text-sm',
        xl: 'w-12 h-12 text-base'
    };

    const initials = getInitials(name);
    const color = getColor(uniqueId || name);
    const sizeClass = sizes[size] || sizes.md;

    return (
        <div
            className={`
                ${sizeClass} 
                ${color.bg} 
                ${color.text} 
                ${color.border}
                rounded-full 
                flex items-center justify-center 
                font-semibold 
                border
                shrink-0
                ${className}
            `}
            title={name}
        >
            {initials}
        </div>
    );
};

export default UserAvatar;
