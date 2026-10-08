export function DataState({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: string | null;
  empty?: string;
}) {
  if (loading) return <div className="panel data-state" role="status">Loading live data…</div>;
  if (error) return <div className="panel data-state data-state-error" role="alert">Unable to load live data: {error}</div>;
  if (empty) return <div className="panel data-state">{empty}</div>;
  return null;
}
