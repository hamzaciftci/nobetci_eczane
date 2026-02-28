const PharmacySkeleton = () => {
  return (
    <div aria-hidden="true">
      {/* Main row */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-5 py-4">
        {/* Icon placeholder */}
        <div className="hidden sm:block h-14 w-14 shrink-0 rounded-md bg-muted animate-pulse" />
        {/* Content */}
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-baseline gap-2">
            <div className="h-4 w-40 rounded bg-muted animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-3 w-full rounded bg-muted animate-pulse" />
          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
        </div>
        {/* Action links (desktop) */}
        <div className="hidden md:flex shrink-0 flex-col items-end gap-2">
          <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          <div className="h-4 w-24 rounded bg-muted animate-pulse" />
        </div>
      </div>
      {/* Mobile action buttons */}
      <div className="mt-1 flex gap-3 md:hidden">
        <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
        <div className="h-10 flex-1 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
};

export const PharmacySkeletonList = ({ count = 3 }: { count?: number }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <PharmacySkeleton key={i} />
    ))}
  </div>
);

export default PharmacySkeleton;
