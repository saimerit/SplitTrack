import { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PullToRefresh - Custom pull-to-refresh component
 * Triggers callback when user pulls down on touch device
 */
const PullToRefresh = ({ children, onRefresh, threshold = 80 }) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const containerRef = useRef(null);
    const startY = useRef(0);
    const isPulling = useRef(false);

    const handleTouchStart = useCallback((e) => {
        if (containerRef.current?.scrollTop === 0) {
            startY.current = e.touches[0].clientY;
            isPulling.current = true;
        }
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (!isPulling.current || isRefreshing) return;

        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;

        if (diff > 0 && containerRef.current?.scrollTop === 0) {
            // Apply resistance to pull
            const resistance = 0.4;
            setPullDistance(Math.min(diff * resistance, threshold * 1.5));

            if (diff > 10) {
                e.preventDefault();
            }
        }
    }, [isRefreshing, threshold]);

    const handleTouchEnd = useCallback(async () => {
        if (!isPulling.current) return;
        isPulling.current = false;

        if (pullDistance >= threshold && !isRefreshing) {
            setIsRefreshing(true);
            setPullDistance(threshold * 0.6);

            try {
                await onRefresh?.();
            } finally {
                setIsRefreshing(false);
                setPullDistance(0);
            }
        } else {
            setPullDistance(0);
        }
    }, [pullDistance, threshold, isRefreshing, onRefresh]);

    const progress = Math.min(pullDistance / threshold, 1);
    const rotation = progress * 180;

    return (
        <div
            ref={containerRef}
            className="ptr-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull indicator */}
            <div
                className="flex justify-center items-center transition-all duration-200 overflow-hidden"
                style={{
                    height: pullDistance,
                    opacity: progress
                }}
            >
                <div
                    className={`p-2 rounded-full bg-white/10 ${isRefreshing ? 'ptr-spinner' : ''}`}
                    style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: isRefreshing ? 'none' : 'transform 0.1s ease'
                    }}
                >
                    <RefreshCw
                        size={20}
                        className={`${progress >= 1 ? 'text-sky-400' : 'text-gray-400'}`}
                    />
                </div>
            </div>

            {/* Content */}
            <div
                style={{
                    transform: `translateY(${Math.max(0, pullDistance - 40)}px)`,
                    transition: isPulling.current ? 'none' : 'transform 0.2s ease'
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default PullToRefresh;
