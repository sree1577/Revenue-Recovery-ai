import { getRecoveryCase } from "@/lib/recovery-cases";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const recoveryCase = await getRecoveryCase(id);
  if (!recoveryCase) {
    return Response.json({ success: false, data: null, error: { code: "CASE_NOT_FOUND", message: "Recovery case was not found." } }, { status: 404 });
  }
  return Response.json({ success: true, data: recoveryCase, error: null });
}
