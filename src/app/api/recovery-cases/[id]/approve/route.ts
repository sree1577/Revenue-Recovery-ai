import { AuditActor, RecoveryCaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const result = await prisma.$transaction(async (database) => {
      const recoveryCase = await database.recoveryCase.findFirst({ where: { OR: [{ id }, { caseNumber: id }] } });
      if (!recoveryCase) return { kind: "not-found" as const };
      if (recoveryCase.status === RecoveryCaseStatus.RECOVERED || recoveryCase.status === RecoveryCaseStatus.STOPPED || recoveryCase.status === RecoveryCaseStatus.EXPIRED) return { kind: "invalid" as const };
      const approvedAt = new Date();
      const updated = await database.recoveryCase.update({ where: { id: recoveryCase.id }, data: { status: RecoveryCaseStatus.APPROVED, approvedAt } });
      await database.recoveryAction.updateMany({ where: { recoveryCaseId: recoveryCase.id, status: "PENDING" }, data: { status: "APPROVED" } });
      await database.auditLog.create({ data: { recoveryCaseId: recoveryCase.id, eventType: "CASE_APPROVED", actor: AuditActor.MERCHANT, decision: "Merchant approved recommended recovery action.", outputSnapshot: { status: RecoveryCaseStatus.APPROVED }, policyVersion: "2026-09-01" } });
      return { kind: "ok" as const, status: updated.status };
    });
    if (result.kind === "not-found") return Response.json({ success: false, data: null, error: { code: "CASE_NOT_FOUND", message: "Recovery case was not found." } }, { status: 404 });
    if (result.kind === "invalid") return Response.json({ success: false, data: null, error: { code: "CASE_NOT_APPROVABLE", message: "This case cannot be approved in its current state." } }, { status: 409 });
    return Response.json({ success: true, data: result, error: null });
  } catch {
    return Response.json({ success: false, data: null, error: { code: "APPROVAL_FAILED", message: "Approval could not be saved." } }, { status: 500 });
  }
}
