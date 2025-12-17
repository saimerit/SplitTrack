const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-white/10 rounded ${className}`}></div>
);

export const DashboardSkeleton = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-32 glass-card p-6 flex flex-col justify-between">
                    <Skeleton className="h-4 w-24 mb-4" />
                    <Skeleton className="h-8 w-32" />
                </div>
            ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-64 w-full rounded-2xl" />
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <div className="lg:col-span-1 space-y-4">
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        </div>
    </div>
);

export default Skeleton;
