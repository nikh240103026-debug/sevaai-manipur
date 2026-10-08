"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { DataState } from "@/components/data-state";
import { apiRequest } from "@/lib/client";

interface Anomaly {
  village_id?: string;
  village?: string;
  anomaly_status?: string;
  is_anomaly?: boolean;
  anomaly_score?: number;
  score?: number;
  severity?: string;
  priority?: string;
  reason_codes?: string[];
  explanation?: string;
}

export default function AlertsPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Anomaly[]>("/api/v1/ai/anomalies", { signal: controller.signal })
      .then(setAnomalies)
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load anomaly data.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <AppShell title="Alerts">
      <PageHeading eyebrow="EARLY WARNING · AI SIGNALS" title="Unusual service patterns" detail="Review model-flagged patterns and their explanations for follow-up." />
      <div className="data-note anomaly-disclaimer"><strong>An unusual pattern is not evidence of fraud.</strong> Anomaly signals indicate statistical patterns for review only.</div>
      <DataState loading={loading} error={error} empty={!loading && !error && anomalies.length === 0 ? "The anomaly API returned no unusual patterns." : undefined} />
      {!loading && !error && anomalies.length > 0 && (
        <section className="alert-list" aria-label="AI anomaly results">
          {anomalies.map((anomaly, index) => {
            const villageName = anomaly.village ?? anomaly.village_id ?? `Anomaly ${index + 1}`;
            const villageId = anomaly.village_id;
            const score = anomaly.anomaly_score ?? anomaly.score;
            const status = anomaly.anomaly_status ?? (anomaly.is_anomaly === undefined ? "Unusual pattern" : anomaly.is_anomaly ? "Anomaly" : "Not anomalous");
            const severity = anomaly.severity ?? anomaly.priority;
            return (
              <article className="panel alert-card" key={villageId ?? `${villageName}-${index}`}>
                <div className="alert-priority-rail" />
                <div className="alert-card-content">
                  <div className="alert-card-top"><span className="priority-badge priority-badge-medium"><i />{status}</span>{severity && <span className="priority-badge priority-badge-high"><i />{severity}</span>}{score !== undefined && <span className="alert-time">Score {score.toFixed(3)}</span>}</div>
                  <h2>{villageId ? <Link href={`/villages/${villageId}`}>{villageName}</Link> : villageName}</h2>
                  <div className="section-eyebrow">REASON CODES</div>
                  {anomaly.reason_codes?.length ? <ul>{anomaly.reason_codes.map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>No reason codes were returned.</p>}
                  <div className="section-eyebrow">AI EXPLANATION</div>
                  <p>{anomaly.explanation ?? "No explanation was returned for this anomaly."}</p>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </AppShell>
  );
}
