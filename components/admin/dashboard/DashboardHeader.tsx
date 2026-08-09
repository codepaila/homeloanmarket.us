export function DashboardHeader({ generatedAt }: { generatedAt: string }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational monitoring and platform growth across HomeLoanMarket.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Reporting context: {new Date(generatedAt).toLocaleString()}
      </p>
    </div>
  )
}
