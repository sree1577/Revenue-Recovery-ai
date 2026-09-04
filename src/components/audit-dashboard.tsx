"use client";

import { useEffect, useState } from "react";

type AuditEvent = { id: string; timestamp: string; caseNumber: string; event: string; actor: string; decision: string; policyVersion: string; result: string };

const protections = [
  ["Contact attempts prevented", "7", "Consent or safety policy blocks"],
  ["Opted-out customers protected", "3", "No-contact preference honored"],
  ["Duplicate webhooks ignored", "0", "Idempotency protection"],
  ["High-value cases escalated", "2", "Merchant approval required"],
  ["Invalid signatures rejected", "0", "Webhook verification"],
  ["Cases stopped after payment", "0", "Future actions cancelled"],
];

export function AuditDashboard() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/audit?filter=${filter}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to load audit events.");
        setEvents(body.data.events);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load audit events."))
      .finally(() => setLoading(false));
  }, [filter]);

  return <>
    <section className="protection-grid">{protections.map(([label, value, detail]) => <article className="panel protection-card" key={label}><small>{label}</small><strong>{value}</strong><p>{detail}</p></article>)}</section>
    <section className="panel audit-panel">
      <div className="audit-toolbar"><div><h2>Audit timeline</h2><p>Sanitized decisions and safety events. Sensitive payment data is never displayed.</p></div><label>Filter events<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="ALL">All events</option><option value="AGENT">Agent decisions</option><option value="MERCHANT">Merchant approvals</option><option value="RAZORPAY">Razorpay events</option><option value="SAFETY">Safety blocks</option><option value="ERROR">Errors</option></select></label></div>
      {loading && <p className="state" role="status">Loading audit events...</p>}
      {!loading && error && <div className="state error" role="alert"><strong>Unable to load audit events</strong><p>{error}</p><button type="button" onClick={() => setFilter(filter)}>Retry</button></div>}
      {!loading && !error && events.length === 0 && <p className="state">No audit events match this filter.</p>}
      {!loading && !error && events.length > 0 && <div className="scroll"><table><thead><tr><th>Timestamp</th><th>Case</th><th>Event</th><th>Actor</th><th>Decision</th><th>Policy</th><th>Result</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{new Date(event.timestamp).toLocaleString("en-IN")}</td><td>{event.caseNumber}</td><td>{event.event.replaceAll("_", " ")}</td><td>{event.actor}</td><td>{event.decision}</td><td>{event.policyVersion}</td><td>{event.result}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}
