"use client";

import { useState, type FormEvent } from "react";
import { AppShell, PageHeading } from "@/components/app-shell";
import { villages } from "@/lib/demo-data";

type Intervention = {
  id: number;
  title: string;
  village: string;
  assignee: string;
  dueDate: string;
  status: "Assigned" | "In progress" | "Verified" | "Resolved";
};

const startingInterventions: Intervention[] = [
  { id: 1, title: "Verify drinking water access", village: "Churachandpur Demo Village 018", assignee: "Field team A", dueDate: "2025-04-12", status: "In progress" },
  { id: 2, title: "Review pending welfare cases", village: "Bishnupur Demo Village 002", assignee: "Field team B", dueDate: "2025-04-15", status: "Assigned" },
  { id: 3, title: "Confirm healthcare service availability", village: "Senapati Demo Village 021", assignee: "Field team A", dueDate: "2025-04-18", status: "Verified" },
];

export default function InterventionsPage() {
  const [items, setItems] = useState(startingInterventions);
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");

  function createIntervention(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedVillage = villages.find((item) => item.id === form.get("village"));
    if (!selectedVillage) {
      setNotice("Choose a village from the list.");
      return;
    }
    const newItem: Intervention = {
      id: Date.now(),
      title: String(form.get("title")),
      village: selectedVillage.name,
      assignee: String(form.get("assignee")),
      dueDate: String(form.get("dueDate")),
      status: "Assigned",
    };
    setItems((current) => [newItem, ...current]);
    setFormOpen(false);
    setNotice("Intervention added to this demo workspace.");
    event.currentTarget.reset();
  }

  function advanceStatus(id: number) {
    const nextStatus: Record<Intervention["status"], Intervention["status"]> = {
      Assigned: "In progress",
      "In progress": "Verified",
      Verified: "Resolved",
      Resolved: "Resolved",
    };
    setItems((current) => current.map((item) => item.id === id ? { ...item, status: nextStatus[item.status] } : item));
  }

  return (
    <AppShell title="Interventions">
      <PageHeading
        eyebrow="FIELD OPERATIONS"
        title="Interventions"
        detail="Create, assign, track, verify, and resolve sample field actions."
        action={<button className="button button-primary" onClick={() => { setFormOpen(!formOpen); setNotice(""); }} type="button">{formOpen ? "Cancel" : "+ New intervention"}</button>}
      />
      <div className="demo-notice">
        <span className="notice-icon" aria-hidden="true">ⓘ</span>
        <span><strong>Demo workspace</strong> · Intervention updates are held in page state only and are not sent to an API.</span>
      </div>
      {notice && <div className="form-feedback" role="status">{notice}</div>}
      {formOpen && (
        <form className="panel intervention-form" onSubmit={createIntervention}>
          <div className="section-heading"><div><div className="section-eyebrow">NEW FIELD ACTION</div><h2>Create an intervention</h2><p>Enter a sample assignment for this preview.</p></div></div>
          <div className="intervention-form-grid">
            <label>Action title<input name="title" placeholder="e.g. Verify water access" required /></label>
            <label>Village<select name="village" required defaultValue=""><option disabled value="">Choose a village</option>{villages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}</select></label>
            <label>Assign to<input name="assignee" placeholder="Field team or owner" required /></label>
            <label>Due date<input name="dueDate" type="date" required /></label>
          </div>
          <button className="button button-primary" type="submit">Create intervention</button>
        </form>
      )}
      <section className="intervention-status-grid">
        {(["Assigned", "In progress", "Verified", "Resolved"] as const).map((status) => (
          <article className="panel intervention-status-card" key={status}><span>{status}</span><strong>{items.filter((item) => item.status === status).length}</strong></article>
        ))}
      </section>
      <section className="panel intervention-list-panel">
        <div className="section-heading"><div><div className="section-eyebrow">ACTION TRACKER</div><h2>Assigned interventions</h2><p>{items.length} sample field actions</p></div></div>
        <div className="intervention-list">
          {items.map((item) => (
            <article className="intervention-row" key={item.id}>
              <span className={`intervention-status-mark intervention-mark-${item.status.toLowerCase().replace(" ", "-")}`} aria-hidden="true" />
              <div className="intervention-row-main"><h3>{item.title}</h3><p>{item.village}</p><span>Assigned to {item.assignee} · Due {item.dueDate || "Not set"}</span></div>
              <span className={`intervention-state state-${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span>
              {item.status !== "Resolved" && <button className="button button-secondary intervention-advance" onClick={() => advanceStatus(item.id)} type="button">{item.status === "In progress" ? "Verify" : item.status === "Verified" ? "Resolve" : "Start"}</button>}
            </article>
          ))}
          {items.length === 0 && <p className="empty-state">No interventions yet. Create an intervention to get started.</p>}
        </div>
      </section>
    </AppShell>
  );
}
