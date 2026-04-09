export function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 animate-pulse">
      <div className="flex gap-4">
        <div className="w-16 h-16 rounded-lg bg-muted flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-3 bg-muted rounded w-1/2" />
          <div className="h-1.5 bg-muted rounded w-full mt-3" />
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <div className="h-5 w-20 bg-muted rounded-full" />
        <div className="h-5 w-24 bg-muted rounded-full" />
        <div className="h-5 w-16 bg-muted rounded-full" />
      </div>
    </div>
  );
}
