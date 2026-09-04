import { getRecoveryCase } from "@/lib/recovery-cases";
import { generateRecoveryMessage } from "@/lib/ai/recovery-message";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const recoveryCase = await getRecoveryCase(id);
  if (!recoveryCase) {
    return Response.json({ success: false, data: null, error: { code: "CASE_NOT_FOUND", message: "Recovery case was not found." } }, { status: 404 });
  }

  const consentAvailable = recoveryCase.customer.doNotContact === false && Boolean(recoveryCase.recommendedChannel);
  const result = await generateRecoveryMessage({
    customerName: recoveryCase.customer.name,
    failureCategory: recoveryCase.failureReason,
    recommendedAction: recoveryCase.recommendedAction,
    amountPaise: recoveryCase.transaction.amountPaise,
    consentAvailable,
    paymentConfirmed: recoveryCase.status === "RECOVERED",
  });

  return Response.json({ success: true, data: { ...result, demo: recoveryCase.demo }, error: null });
}
