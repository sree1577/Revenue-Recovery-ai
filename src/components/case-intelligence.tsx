"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CaseData = {
  caseNumber: string;
  demo: boolean;
  customer: { name: string; email: string | null; phone: string | null; doNotContact: boolean };
  transaction: { amountPaise: number; paymentMethod: string; errorReason: string | null; attemptCount: number };
  status: string;
  priorityScore: number;
  recoveryProbability: number;
  recommendedAction: string;
  recommendedChannel: string | null;
  recommendedDelayMinutes: number;
  decisionExplanation: string;
  requiresApproval: boolean;
  paymentLinkUrl: string | null;
  recoveryAttemptCount: number;
  maxRecoveryAttempts: number;
};
type GeneratedMessage = { customerMessage: string; caseSummary: string; failureExplanation: string; source: "groq" | "fallback" };
type PaymentLink = { paymentLinkId: string; paymentLinkUrl: string; expiresAt: string; simulated: boolean; reused: boolean };

export function CaseIntelligence({ caseId }: { caseId: string }) {
  const [data, setData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "stop" | "message" | "payment" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [generatedMessage, setGeneratedMessage] = useState<GeneratedMessage | null>(null);
  const [paymentLink, setPaymentLink] = useState<PaymentLink | null>(null);

  useEffect(() => {
    fetch(`/api/recovery-cases/${encodeURIComponent(caseId)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to load this case.");
        setData(body.data);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load this case."))
      .finally(() => setLoading(false));
  }, [caseId, refreshKey]);

  async function runAction(kind: "approve" | "reject" | "stop") {
    if (!data || action) return;
    const reason = kind === "approve" ? undefined : window.prompt(kind === "reject" ? "Why should this recovery be rejected?" : "Why should recovery stop?");
    if (kind !== "approve" && !reason?.trim()) return;
    if (kind !== "approve" && !window.confirm(`Confirm ${kind === "reject" ? "rejection" : "stopping recovery"}?`)) return;
    if (kind === "approve" && !window.confirm("Approve this recovery action?")) return;
    setAction(kind);
    setFeedback("");
    try {
      const response = await fetch(`/api/recovery-cases/${encodeURIComponent(caseId)}/${kind}`, {
        method: "POST",
        headers: kind === "approve" ? undefined : { "Content-Type": "application/json" },
        body: kind === "approve" ? undefined : JSON.stringify({ reason }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "The case action failed.");
      setFeedback(kind === "approve" ? "Recovery approved." : kind === "reject" ? "Recovery rejected." : "Recovery stopped.");
      setRefreshKey((value) => value + 1);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "The case action failed.");
    } finally {
      setAction(null);
    }
  }

  async function generateMessage() {
    if (!data || action) return;
    setAction("message");
    setFeedback("");
    try {
      const response = await fetch(`/api/recovery-cases/${encodeURIComponent(caseId)}/message`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "The message could not be generated.");
      setGeneratedMessage({ ...body.data.message, source: body.data.source });
      setFeedback(body.data.source === "groq" ? "AI message generated." : "Fallback message generated; Groq is unavailable.");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "The message could not be generated.");
    } finally {
      setAction(null);
    }
  }

  async function createPaymentLink() {
    if (!data || action || data.status === "RECOVERED" || data.status === "STOPPED") return;
    if (!window.confirm("Create a payment link for this recovery case?")) return;
    setAction("payment");
    setFeedback("");
    try {
      const response = await fetch(`/api/recovery-cases/${encodeURIComponent(caseId)}/payment-link`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "The payment link could not be created.");
      setPaymentLink(body.data);
      setFeedback(body.data.simulated ? "Simulated payment link created in demo mode." : body.data.reused ? "Existing payment link reused." : "Razorpay Test Mode payment link created.");
      if (!body.data.simulated) setRefreshKey((value) => value + 1);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "The payment link could not be created.");
    } finally {
      setAction(null);
    }
  }

  if (loading) return <section className="panel state" role="status">Loading case intelligence...</section>;
  if (error) return <section className="panel state error" role="alert"><strong>Unable to load case</strong><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></section>;
  if (!data) return <section className="panel state"><strong>Case not found</strong><p>Return to the queue and choose an available case.</p><Link className="button outline" href="/recovery-queue">Back to queue</Link></section>;

  return <>
    <section className="case-summary panel">
      <div><em>{data.demo ? "DEMO CASE" : "RECOVERY CASE"}</em><h2>{data.caseNumber}</h2><p>{data.customer.name} · {data.customer.email ?? "No email on file"}</p></div>
      <div><small>TRANSACTION AMOUNT</small><strong className="case-amount">₹{(data.transaction.amountPaise / 100).toLocaleString("en-IN")}</strong><span className="pill ready">{data.status.replaceAll("_", " ")}</span></div>
      <div><small>PRIORITY SCORE</small><strong className="case-amount">{data.priorityScore}/100</strong><p>{data.recoveryProbability}% estimated recovery</p></div>
    </section>
    <section className="case-grid">
      <article className="panel"><em>FAILURE DIAGNOSIS</em><h2>{data.transaction.errorReason?.replaceAll("_", " ")}</h2><p>{data.decisionExplanation}</p><dl className="facts"><div><dt>Payment method</dt><dd>{data.transaction.paymentMethod}</dd></div><div><dt>Attempts</dt><dd>{data.recoveryAttemptCount}/{data.maxRecoveryAttempts}</dd></div><div><dt>Recommended channel</dt><dd>{data.recommendedChannel ?? "None"}</dd></div><div><dt>Recommended delay</dt><dd>{data.recommendedDelayMinutes} minutes</dd></div></dl></article>
      <article className="panel"><em>POLICY CHECKS</em><div className="check-list"><p>✓ Consent and contact preferences required</p><p>✓ Attempt limit: {data.recoveryAttemptCount < data.maxRecoveryAttempts ? "within limit" : "reached"}</p><p>✓ Customer opted out: {data.customer.doNotContact ? "yes, recovery stopped" : "no"}</p><p>✓ Approval: {data.requiresApproval ? "merchant approval required" : "not required"}</p></div><div className="recommendation"><small>AGENT RECOMMENDATION</small><strong>{data.recommendedAction}</strong></div></article>
    </section>
    <section className="panel case-notice"><strong>{data.status === "RECOVERED" ? "Recovery complete" : data.demo ? "Demo mode: approval and stop actions are disabled." : "Case actions"}</strong><p>{data.status === "RECOVERED" ? "This case is terminal and no further recovery action is available." : data.demo ? "Message and simulated payment-link generation are available without external connections." : "Approval, payment-link, and stopping decisions are recorded in the audit log."}</p>{data.status === "RECOVERED" ? <div className="recovery-confirmed" role="status"><p>✓ Payment verified</p><p>✓ Revenue recovered</p><p>✓ Future reminders stopped</p></div> : <div className="case-actions"><button type="button" disabled={action !== null || data.status === "STOPPED"} onClick={generateMessage}>{action === "message" ? "Generating..." : "Generate customer message"}</button><button type="button" disabled={action !== null || data.status === "STOPPED"} onClick={createPaymentLink}>{action === "payment" ? "Creating link..." : "Create payment link"}</button>{!data.demo && data.status !== "STOPPED" && <><button type="button" disabled={action !== null} onClick={() => runAction("approve")}>{action === "approve" ? "Approving..." : "Approve recovery"}</button><button type="button" className="outline" disabled={action !== null} onClick={() => runAction("reject")}>{action === "reject" ? "Rejecting..." : "Reject"}</button><button type="button" className="danger-button" disabled={action !== null} onClick={() => runAction("stop")}>{action === "stop" ? "Stopping..." : "Stop recovery"}</button></>}</div>}{feedback && <p className={feedback.includes("could not") || feedback.includes("failed") ? "error" : "success"} role="status">{feedback}</p>}{generatedMessage && <div className="message-preview"><small>CUSTOMER MESSAGE · {generatedMessage.source === "groq" ? "GROQ AI" : "DETERMINISTIC FALLBACK"}</small><p>{generatedMessage.customerMessage || "No customer message generated because contact is blocked."}</p><strong>{generatedMessage.caseSummary}</strong><p>{generatedMessage.failureExplanation}</p></div>}{paymentLink && <div className="message-preview"><small>{paymentLink.simulated ? "SIMULATED DEMO PAYMENT LINK" : "RAZORPAY TEST MODE PAYMENT LINK"}</small><p>{paymentLink.simulated ? "This URL is not a real payment link and does not charge anyone." : "This link is created in Razorpay Test Mode."}</p><a className="button outline" href={paymentLink.paymentLinkUrl} target="_blank" rel="noreferrer">Open test link</a></div>}{data.paymentLinkUrl && !paymentLink && <div className="message-preview"><small>RAZORPAY PAYMENT LINK</small><a className="button outline" href={data.paymentLinkUrl} target="_blank" rel="noreferrer">Open payment link</a></div>}<Link href="/integrations" className="link">View integration status →</Link></section>
  </>;
}
