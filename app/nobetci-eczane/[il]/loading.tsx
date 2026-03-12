/**
 * İl sayfası yüklenme iskelet ekranı.
 * Streaming / Suspense ile gösterilir.
 */

export default function CityLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Breadcrumb placeholder */}
      <div className="h-4 w-48 bg-gray-200 rounded" />

      {/* Başlık placeholder */}
      <div className="space-y-2">
        <div className="h-9 w-3/4 bg-gray-200 rounded" />
        <div className="h-4 w-1/2 bg-gray-200 rounded" />
      </div>

      {/* Eczane grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
        {Array.from({ length: 9 }).map((_, i) => (
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
