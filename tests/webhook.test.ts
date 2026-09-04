import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyWebhookSignature } from "@/lib/razorpay/webhooks";

describe("Razorpay webhook verification", () => {
  it("accepts a valid HMAC signature", () => { const body = JSON.stringify({ event: "payment_link.paid" }); const signature = createHmac("sha256", "test-secret").update(body).digest("hex"); expect(verifyWebhookSignature(body, signature, "test-secret")).toBe(true); });
  it("rejects a tampered payload", () => { const body = JSON.stringify({ event: "payment_link.paid" }); const signature = createHmac("sha256", "test-secret").update(body).digest("hex"); expect(verifyWebhookSignature(`${body}x`, signature, "test-secret")).toBe(false); });
  it("rejects missing credentials", () => expect(verifyWebhookSignature("{}", null, "test-secret")).toBe(false));
});
