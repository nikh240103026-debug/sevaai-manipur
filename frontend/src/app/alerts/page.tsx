"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { ApiError, apiRequest } from "@/lib/client";
type AnomalyRecord = {
  village_id: string;
  village: string;
  district: string;
  block: string;
  anomaly_score: number | null;
  anomaly_status: "NORMAL" | "UNUSUAL" | "UNAVAILABLE";
  reason_codes: string[];
  explanation: string;
  available: boolean;
};

export default function AlertsPage() {
  const [records, setRecords] = useState<AnomalyRecord[]>([]);
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    apiRequest<AnomalyRecord[]>("/api/v1/ai/anomalies?limit=100")
      .then((result) => {
        if (current) setRecords(result);
      })
      .catch((requestError: unknown) => {
        if (!current) return;
        setError(requestError instanceof ApiError && requestError.status === 401
          ? "Your session has expired. Sign in again to view anomaly results."
          : "Anomaly results could not be loaded. Check your connection and try again.");
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const unusual = useMemo(
    () => records.filter((item) => item.anomaly_status === "UNUSUAL" && !reviewed.includes(item.village_id)),
    [records, reviewed],
  );
  const unavailableCount = records.filter((item) => !item.available).length;

  return (
    <AppShell title="Alerts">
      <PageHeading
        eyebrow="EARLY WARNING · ACTIVE DATASET"
        title="AI-generated alerts"
        detail="Review unusual service and pending patterns detected in your active dataset."
        action={<span className="alert-open-count">{unusual.length} unusual patterns</span>}
      />
      {unavailableCount > 0 && (
        <div className="dashboard-state dashboard-state-empty" role="status">
          Anomaly analysis is unavailable for {unavailableCount.toLocaleString()} records because required current, historical, or pending-rate fields are missing.
        </div>
      )}
      {error && <div className="upload-feedback upload-feedback-error" role="alert">{error}</div>}
      <div className="alert-filter-row">
        <span className="alert-filter-label">Unusual records from the active dataset</span>
        <span className="priority-badge priority-badge-high"><i />Unusual signal</span>
      </div>
      {loading ? (
        <div className="dashboard-state" role="status"><span className="loading-indicator" /> Analyzing active dataset…</div>
      ) : (
        <section className="alert-list" aria-label="Anomaly results">
          {unusual.map((record) => (
            <article className="panel alert-card" key={record.village_id}>
              <div className="alert-priority-rail alert-rail-high" />
              <div className="alert-card-content">
                <div className="alert-card-top">
                  <span className="priority-badge priority-badge-high"><i />Unusual pattern</span>
                  <span className="alert-id">{record.anomaly_score === null ? "Score unavailable" : `Score ${record.anomaly_score.toFixed(3)}`}</span>
                  <span className="alert-time">{record.reason_codes.length} detected factors</span>
                </div>
                <h2>Unusual service pattern · {record.village}</h2>
                <p>{record.explanation}</p>
                <div className="alert-card-footer">
                  <span className="alert-location"><span aria-hidden="true">⌖</span>{record.district}{record.block ? ` · ${record.block}` : ""}</span>
                  <span className="alert-category">Decision-support signal only · not a finding of wrongdoing</span>
                  <Link className="button button-secondary" href={`/villages/${encodeURIComponent(record.village_id)}`}>View village</Link>
                  <button
                    className="button button-secondary"
                    onClick={() => setReviewed((current) => [...current, record.village_id])}
                    type="button"
                  >
                    Mark reviewed
                  </button>
                </div>
              </div>
            </article>
          ))}
          {!unusual.length && !error && (
            <div className="panel no-alerts">
              <span className="metric-icon metric-icon-teal">{unavailableCount ? "i" : "✓"}</span>
              <h2>{unavailableCount ? "Analysis needs more data" : "No unusual patterns detected"}</h2>
              <p>{unavailableCount
                ? "The active dataset does not include enough current, historical, or pending-rate fields for anomaly analysis."
                : "No records were flagged as statistically unusual in the active dataset."}</p>
            </div>
          )}
        </section>
      )}
    </AppShell>
  );
}
