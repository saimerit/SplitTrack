import { useMemo } from 'react';

/**
 * CircularProgress - Animated circular progress ring with percentage
 * Used for bulk actions (delete, edit, rectify)
 * 
 * @param {number} progress - Progress value 0-100
 * @param {number} size - Size of the circle in pixels (default: 64)
 * @param {number} strokeWidth - Width of the progress stroke (default: 4)
 * @param {string} color - Color of the progress stroke (default: 'sky')
 * @param {boolean} showPercentage - Whether to show percentage text (default: true)
 * @param {string} label - Optional label below percentage
 */
const CircularProgress = ({
    progress = 0,
    size = 64,
    strokeWidth = 4,
    color = 'sky',
    showPercentage = true,
    label = ''
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    const offset = useMemo(() => {
        const clampedProgress = Math.min(100, Math.max(0, progress));
        return circumference - (clampedProgress / 100) * circumference;
    }, [progress, circumference]);

    const colorClasses = {
        sky: { stroke: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.2)' },
        emerald: { stroke: '#10b981', bg: 'rgba(16, 185, 129, 0.2)' },
        rose: { stroke: '#f43f5e', bg: 'rgba(244, 63, 94, 0.2)' },
        indigo: { stroke: '#6366f1', bg: 'rgba(99, 102, 241, 0.2)' },
        amber: { stroke: '#f59e0b', bg: 'rgba(245, 158, 11, 0.2)' }
    };

    const colors = colorClasses[color] || colorClasses.sky;

    return (
        <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    className="transform -rotate-90"
                    width={size}
                    height={size}
                >
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={colors.bg}
                        strokeWidth={strokeWidth}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={colors.stroke}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-300 ease-out"
                        style={{
                            filter: `drop-shadow(0 0 6px ${colors.stroke}40)`
                        }}
                    />
                </svg>

                {/* Percentage Text */}
                {showPercentage && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span
                            className="font-mono font-bold text-white"
                            style={{ fontSize: size * 0.22 }}
                        >
                            {Math.round(progress)}%
                        </span>
                    </div>
                )}
            </div>

            {/* Optional Label */}
            {label && (
                <p className="text-gray-400 text-sm animate-pulse">{label}</p>
            )}
        </div>
    );
};

/**
 * CircularProgressOverlay - Full-screen overlay version for bulk operations
 */
export const CircularProgressOverlay = ({
    progress,
    label = 'Processing...',
    isVisible = true
}) => {
    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-100 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm">
            <CircularProgress
                progress={progress}
                size={80}
                strokeWidth={6}
                color="sky"
                showPercentage={true}
            />
            <p className="text-gray-400 text-sm mt-4">{label}</p>
        </div>
    );
};

export default CircularProgress;
