"use client";

import { useEffect, useState } from "react";

type IntegrationData = { razorpay: { configured: boolean; keyId: string | null; webhookConfigured: boolean }; database: { connected: boolean; caseCount: number; lastSuccessfulQuery: string | null }; groq: { configured: boolean; model: string; fallbackEnabled: boolean }; communications: { email: string; sms: string; whatsapp: string } };

export function IntegrationStatus() {
  const [data, setData] = useState<IntegrationData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/integrations").then(async (response) => { const body = await response.json(); if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to load integration status."); setData(body.data); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load integration status.")); }, []);
  if (error) return <section className="panel state error" role="alert"><strong>Integration status unavailable</strong><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button></section>;
  if (!data) return <section className="panel state" role="status">Loading integration status...</section>;
  return <section className="integration-grid"><article className="panel status-card"><strong>Razorpay</strong><span className={`status ${data.razorpay.configured ? "available" : "unavailable"}`}>{data.razorpay.configured ? "Test Mode configured" : "Not configured"}</span><p>Key ID: {data.razorpay.keyId ?? "Not available"}</p><p>Webhook: {data.razorpay.webhookConfigured ? "Configured" : "Not configured"}</p><small>Key Secret is never displayed.</small></article><article className="panel status-card"><strong>Neon PostgreSQL</strong><span className={`status ${data.database.connected ? "available" : "unavailable"}`}>{data.database.connected ? "Connected" : "Unavailable"}</span><p>Cases: {data.database.caseCount}</p><p>Last successful query: {data.database.lastSuccessfulQuery ? new Date(data.database.lastSuccessfulQuery).toLocaleString("en-IN") : "None"}</p></article><article className="panel status-card"><strong>Groq AI</strong><span className={`status ${data.groq.configured ? "available" : "simulated"}`}>{data.groq.configured ? "Configured" : "Fallback only"}</span><p>Model: {data.groq.model}</p><p>Fallback templates: {data.groq.fallbackEnabled ? "Enabled" : "Disabled"}</p></article><article className="panel status-card"><strong>Communications</strong><span className="status simulated">Simulated</span><p>Email: {data.communications.email.toLowerCase()}</p><p>SMS: {data.communications.sms.toLowerCase()}</p><p>WhatsApp: {data.communications.whatsapp.toLowerCase()}</p></article></section>;
}
