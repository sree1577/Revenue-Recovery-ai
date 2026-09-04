import { z } from "zod";
import { getAgentSettings, updateAgentSettings } from "@/lib/agent-settings";

const settingsSchema = z.object({
  enabled: z.boolean(),
  maxRecoveryAttempts: z.number().int().min(1).max(10),
  quietHoursStart: z.number().int().min(0).max(23),
  quietHoursEnd: z.number().int().min(0).max(23),
  approvalThresholdPaise: z.number().int().min(0).max(100_000_000),
  defaultRecoveryDelayMin: z.number().int().min(0).max(10_080),
  demoMode: z.boolean(),
  aiMessageGeneration: z.boolean(),
  simulatedCommunication: z.boolean(),
});

export async function GET() {
  return Response.json({ success: true, data: await getAgentSettings(), error: null });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) return Response.json({ success: false, data: null, error: { code: "INVALID_SETTINGS", message: "Settings contain an invalid value." } }, { status: 400 });
  try {
    return Response.json({ success: true, data: await updateAgentSettings(parsed.data), error: null });
  } catch {
    return Response.json({ success: false, data: null, error: { code: "SETTINGS_UNAVAILABLE", message: "Settings could not be saved because the database is unavailable." } }, { status: 503 });
  }
}
