export default function Loading() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div>
        {/* Header */}
        <div className="mb-5 flex items-baseline gap-3">
          <div className="skeleton h-7 w-16" />
          <div className="skeleton h-4 w-48" />
        </div>

        {/* Filter chips */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton h-6 w-16" />
          ))}
        </div>

        {/* Lead card skeleton */}
        <div className="card mb-5 p-6">
          <div className="flex gap-2">
            <div className="skeleton h-5 w-12" />
            <div className="skeleton h-5 w-16" />
            <div className="skeleton h-5 w-20" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="skeleton h-7 w-full" />
            <div className="skeleton h-7 w-3/4" />
          </div>
          <div className="mt-3 space-y-2">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-11/12" />
            <div className="skeleton h-4 w-4/5" />
          </div>
        </div>

        {/* Timeline skeletons */}
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="skeleton h-4 w-12" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-5/6" />
                <div className="skeleton h-3 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside>
        <div className="card p-4">
          <div className="skeleton h-5 w-20" />
          <div className="mt-3 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="skeleton h-3.5 w-full" />
                <div className="skeleton h-3 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
