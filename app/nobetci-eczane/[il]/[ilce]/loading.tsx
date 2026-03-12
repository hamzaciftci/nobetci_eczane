export default function DistrictLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-64 bg-gray-200 rounded" />
      <div className="space-y-2">
        <div className="h-9 w-2/3 bg-gray-200 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-1/2 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
