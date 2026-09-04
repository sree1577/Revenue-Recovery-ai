import { AuditActor, RecoveryCaseStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };
const bodySchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, data: null, error: { code: "REASON_REQUIRED", message: "A rejection reason is required." } }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (database) => {
      const recoveryCase = await database.recoveryCase.findFirst({ where: { OR: [{ id }, { caseNumber: id }] } });
      if (!recoveryCase) return "not-found" as const;
      if (recoveryCase.status === RecoveryCaseStatus.RECOVERED || recoveryCase.status === RecoveryCaseStatus.STOPPED) return "invalid" as const;
      await database.recoveryCase.update({ where: { id: recoveryCase.id }, data: { status: RecoveryCaseStatus.STOPPED, stoppedAt: new Date(), stopReason: parsed.data.reason } });
      await database.recoveryAction.updateMany({ where: { recoveryCaseId: recoveryCase.id, status: { in: ["PENDING", "APPROVED"] } }, data: { status: "CANCELLED", failureMessage: parsed.data.reason } });
      await database.auditLog.create({ data: { recoveryCaseId: recoveryCase.id, eventType: "CASE_REJECTED", actor: AuditActor.MERCHANT, decision: parsed.data.reason, outputSnapshot: { status: RecoveryCaseStatus.STOPPED }, policyVersion: "2026-09-01" } });
      return "ok" as const;
    });
    if (result === "not-found") return Response.json({ success: false, data: null, error: { code: "CASE_NOT_FOUND", message: "Recovery case was not found." } }, { status: 404 });
    if (result === "invalid") return Response.json({ success: false, data: null, error: { code: "CASE_NOT_REJECTABLE", message: "This case cannot be rejected in its current state." } }, { status: 409 });
    return Response.json({ success: true, data: { status: RecoveryCaseStatus.STOPPED }, error: null });
  } catch {
    return Response.json({ success: false, data: null, error: { code: "REJECTION_FAILED", message: "Rejection could not be saved." } }, { status: 500 });
  }
}
