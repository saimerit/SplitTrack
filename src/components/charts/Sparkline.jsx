/**
 * Sparkline - A minimal 7-day trend visualization
 * Shows recent trend data as tiny bars
 */
const Sparkline = ({ data = [], color = 'text-sky-400', className = '' }) => {
    // Normalize data to 0-100% height
    const safeData = data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
    const max = Math.max(...safeData.map(Math.abs), 1);
    const normalized = safeData.map(v => (Math.abs(v) / max) * 100);

    // Take last 7 values
    const displayData = normalized.slice(-7);

    return (
        <div className={`sparkline-container ${color} ${className}`}>
            {displayData.map((height, i) => (
                <div
                    key={i}
                    className="sparkline-bar"
                    style={{ height: `${Math.max(height, 8)}%` }}
                />
            ))}
        </div>
    );
};

export default Sparkline;
