import { processRazorpayWebhook, verifyWebhookSignature } from "@/lib/razorpay/webhooks";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return Response.json({ success: false, data: null, error: { code: "WEBHOOK_NOT_CONFIGURED", message: "Razorpay webhook verification is not configured." } }, { status: 503 });
  }
  if (!verifyWebhookSignature(rawBody, signature)) {
    return Response.json({ success: false, data: null, error: { code: "INVALID_SIGNATURE", message: "Webhook signature verification failed." } }, { status: 401 });
  }
  try {
    const result = await processRazorpayWebhook({ rawBody, signature, eventId: request.headers.get("x-razorpay-event-id") });
    return Response.json({ success: true, data: result, error: null });
  } catch (error) {
    const message = error instanceof Error && error.message === "PAYMENT_AMOUNT_MISMATCH" ? "Payment amount did not match the recovery case." : "Webhook processing failed safely.";
    return Response.json({ success: false, data: null, error: { code: "WEBHOOK_PROCESSING_FAILED", message } }, { status: 500 });
  }
}
