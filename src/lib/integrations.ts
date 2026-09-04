import { prisma } from "@/lib/prisma";

function maskKey(value: string | undefined) {
  if (!value) return null;
  if (value.length < 8) return "Configured";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function getIntegrationStatus() {
  let database = { connected: false, caseCount: 0, lastSuccessfulQuery: null as string | null };
  try {
    database = { connected: true, caseCount: await prisma.recoveryCase.count(), lastSuccessfulQuery: new Date().toISOString() };
  } catch {
    // The UI reports unavailable until a real database connection is supplied.
  }
  return {
    razorpay: { configured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET), keyId: maskKey(process.env.RAZORPAY_KEY_ID), webhookConfigured: Boolean(process.env.RAZORPAY_WEBHOOK_SECRET) },
    database,
    groq: { configured: Boolean(process.env.GROQ_API_KEY), model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile", fallbackEnabled: true },
    communications: { email: "SIMULATED", sms: "SIMULATED", whatsapp: "SIMULATED" },
  };
}
