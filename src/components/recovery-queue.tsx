"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type RecoveryCase = {
  id: string;
  caseNumber: string;
  customer: string;
  amountPaise: number;
  paymentMethod: string;
  failureReason: string;
  priorityScore: number;
  recoveryProbability: number;
  recommendedAction: string;
  attempts: number;
  status: string;
  nextActionAt: string | null;
  requiresApproval: boolean;
  demo: boolean;
};

export function RecoveryQueue() {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/recovery-cases")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to load recovery cases.");
        setCases(body.data.cases);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load recovery cases."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((item) => {
    const matchesStatus = status === "ALL" || (status === "HIGH" ? item.priorityScore >= 70 : status === "APPROVAL" ? item.requiresApproval : item.status === status);
    const text = `${item.caseNumber} ${item.customer} ${item.failureReason}`.toLowerCase();
    return matchesStatus && text.includes(query.toLowerCase());
  });
  const activeCases = cases.filter((item) => !["RECOVERED", "STOPPED", "EXPIRED"].includes(item.status));
  const revenueAtRisk = activeCases.reduce((total, item) => total + item.amountPaise, 0);
  const recoveryOpportunity = activeCases.filter((item) => !item.requiresApproval).reduce((total, item) => total + item.amountPaise, 0);
  const needsApproval = cases.filter((item) => item.status === "AWAITING_APPROVAL" || item.requiresApproval).length;
  const money = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
  const statusLabel = (value: string) => value.toLowerCase().replaceAll("_", " ").replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  const priorityLabel = (value: number) => value >= 90 ? "HIGH" : value >= 70 ? "MEDIUM" : "LOW";

  return (
    <section className="queue-workspace">
      {!loading && !error && <div className="queue-metrics"><article className="panel queue-metric"><span className="metric-icon blue-icon">◫</span><div><small>ACTIVE CASES</small><strong>{activeCases.length}</strong><p>Cases needing recovery action</p></div></article><article className="panel queue-metric"><span className="metric-icon red-icon">₹</span><div><small>REVENUE AT RISK</small><strong>{money(revenueAtRisk)}</strong><p>Active failed-payment value</p></div></article><article className="panel queue-metric"><span className="metric-icon green-icon">↗</span><div><small>RECOVERY OPPORTUNITY</small><strong>{money(recoveryOpportunity)}</strong><p>Ready for safe recovery</p></div></article><article className="panel queue-metric"><span className="metric-icon amber-icon">!</span><div><small>NEEDS APPROVAL</small><strong>{needsApproval}</strong><p>Merchant decisions required</p></div></article></div>}
    <section className="panel queue-panel">
      <div className="queue-toolbar">
        <label>Search cases<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Case, customer, or failure" /></label>
        <label>Filter by status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">All cases</option><option value="HIGH">High priority</option><option value="APPROVAL">Approval required</option><option value="ANALYZED">Analyzed</option><option value="AWAITING_APPROVAL">Awaiting approval</option><option value="STOPPED">Stopped</option><option value="RECOVERED">Recovered</option></select></label>
      </div>
      {loading && <p className="state" role="status">Loading recovery cases...</p>}
      {!loading && error && <div className="state error" role="alert"><strong>Unable to load cases</strong><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></div>}
      {!loading && !error && filtered.length === 0 && <p className="state">No cases match the selected filters.</p>}
      {!loading && !error && filtered.length > 0 && <div className="scroll"><table><thead><tr><th>Case</th><th>Customer</th><th>Amount</th><th>Failure</th><th>Priority</th><th>Probability</th><th>AI Next Action</th><th>Attempts</th><th>Status</th><th /></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.caseNumber}</strong></td><td>{item.customer}</td><td><strong>{money(item.amountPaise)}</strong></td><td>{item.failureReason.replaceAll("_", " ").toLowerCase()}</td><td><b className={`priority-badge priority-${priorityLabel(item.priorityScore).toLowerCase()}`}><strong>{item.priorityScore}</strong><span>{priorityLabel(item.priorityScore)}</span></b></td><td><div className="probability-cell"><strong>{item.recoveryProbability}%</strong><span className="progress-track"><span style={{ width: `${Math.min(item.recoveryProbability, 100)}%` }} /></span></div></td><td className="action-cell">{item.recommendedAction}</td><td>{item.attempts}</td><td><span className={`pill ${item.status === "STOPPED" ? "stopped" : item.requiresApproval ? "approval" : item.status === "RECOVERED" ? "recovered" : "ready"}`}>{statusLabel(item.status)}</span></td><td><Link className="case-link" href={`/cases/${item.caseNumber}`}>View Case <span aria-hidden="true">→</span></Link></td></tr>)}</tbody></table></div>}
    </section>
    </section>
  );
}
