const PharmacySkeleton = () => {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3" aria-hidden="true">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <div className="h-5 w-36 rounded bg-muted animate-pulse" />
          <div className="h-3 w-16 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-5 w-10 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-4 w-full rounded bg-muted animate-pulse" />
      <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      <div className="h-3 w-48 rounded bg-muted animate-pulse" />
      <div className="flex gap-1.5">
        <div className="h-8 w-14 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
        <div className="h-8 w-14 rounded-md bg-muted animate-pulse" />
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
