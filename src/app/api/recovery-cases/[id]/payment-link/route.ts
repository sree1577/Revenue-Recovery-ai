import { createPaymentLink } from "@/lib/razorpay/payment-links";

type RouteContext = { params: Promise<{ id: string }> };

const errorMap: Record<string, { code: string; message: string; status: number }> = {
  CASE_NOT_FOUND: { code: "CASE_NOT_FOUND", message: "Recovery case was not found.", status: 404 },
  CASE_RECOVERED: { code: "CASE_RECOVERED", message: "A recovered case cannot create another payment link.", status: 409 },
  CASE_STOPPED: { code: "CASE_STOPPED", message: "A stopped case cannot create a payment link.", status: 409 },
  APPROVAL_REQUIRED: { code: "APPROVAL_REQUIRED", message: "Merchant approval is required before creating this payment link.", status: 409 },
  RAZORPAY_NOT_CONFIGURED: { code: "RAZORPAY_NOT_CONFIGURED", message: "Razorpay is not configured. Enable demo mode or add server credentials.", status: 503 },
};

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const result = await createPaymentLink(id);
    return Response.json({ success: true, data: result, error: null });
  } catch (error) {
    const key = error instanceof Error ? error.message : "PAYMENT_LINK_FAILED";
    const mapped = errorMap[key] ?? { code: "PAYMENT_LINK_FAILED", message: "Payment link creation failed safely. No charge was made.", status: 500 };
    return Response.json({ success: false, data: null, error: { code: mapped.code, message: mapped.message } }, { status: mapped.status });
  }
}
