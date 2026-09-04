import { prisma } from "@/lib/prisma";

export type AuditEvent = {
  id: string;
  timestamp: string;
  caseNumber: string;
  event: string;
  actor: string;
  decision: string;
  policyVersion: string;
  result: string;
};

const demoEvents: AuditEvent[] = [
  { id: "demo-audit-1", timestamp: "2026-09-04T09:12:00.000Z", caseNumber: "PAY-1048", event: "CASE_ANALYZED", actor: "AGENT", decision: "Create fresh UPI payment link", policyVersion: "2026-09-01", result: "Approval not required" },
  { id: "demo-audit-2", timestamp: "2026-09-04T09:14:00.000Z", caseNumber: "PAY-1050", event: "CASE_ANALYZED", actor: "AGENT", decision: "Offer UPI or another card", policyVersion: "2026-09-01", result: "Merchant approval required" },
  { id: "demo-audit-3", timestamp: "2026-09-04T09:16:00.000Z", caseNumber: "PAY-1052", event: "SAFETY_BLOCKED", actor: "AGENT", decision: "Stop automated recovery", policyVersion: "2026-09-01", result: "Risk policy requires human review" },
];

function sanitize(value: string | null) {
  return value?.replace(/[\r\n]/g, " ").slice(0, 240) ?? "-";
}

export async function listAuditEvents(filter?: string) {
  try {
    const logs = await prisma.auditLog.findMany({
      include: { recoveryCase: { select: { caseNumber: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const events = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      caseNumber: log.recoveryCase?.caseNumber ?? "WORKSPACE",
      event: log.eventType,
      actor: log.actor,
      decision: sanitize(log.decision),
      policyVersion: log.policyVersion,
      result: sanitize(typeof log.outputSnapshot === "object" && log.outputSnapshot !== null && "status" in log.outputSnapshot ? String(log.outputSnapshot.status) : "Recorded"),
    }));
    return { events: filterEvents(events, filter), demo: false };
  } catch {
    return { events: filterEvents(demoEvents, filter), demo: true };
  }
}

function filterEvents(events: AuditEvent[], filter?: string) {
  if (!filter || filter === "ALL") return events;
  if (filter === "SAFETY") return events.filter((event) => event.event.includes("STOP") || event.event.includes("BLOCK") || event.result.toLowerCase().includes("risk"));
  if (filter === "ERROR") return events.filter((event) => event.event.includes("ERROR") || event.result.toLowerCase().includes("fail"));
  return events.filter((event) => event.actor === filter);
}
