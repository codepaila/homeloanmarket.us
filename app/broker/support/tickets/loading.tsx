export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded bg-muted" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded bg-muted" />
    </div>
  )
}