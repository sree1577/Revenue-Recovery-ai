import { prisma } from "@/lib/prisma";

export type AgentSettings = {
  enabled: boolean;
  maxRecoveryAttempts: number;
  quietHoursStart: number;
  quietHoursEnd: number;
  approvalThresholdPaise: number;
  defaultRecoveryDelayMin: number;
  demoMode: boolean;
  aiMessageGeneration: boolean;
  simulatedCommunication: boolean;
  source: "database" | "environment";
};

function environmentSettings(): AgentSettings {
  return {
    enabled: true,
    maxRecoveryAttempts: Number(process.env.MAX_RECOVERY_ATTEMPTS ?? 3),
    quietHoursStart: 21,
    quietHoursEnd: 9,
    approvalThresholdPaise: Number(process.env.APPROVAL_THRESHOLD_PAISE ?? 1_000_000),
    defaultRecoveryDelayMin: 30,
    demoMode: process.env.DEMO_MODE !== "false",
    aiMessageGeneration: true,
    simulatedCommunication: true,
    source: "environment",
  };
}

export async function getAgentSettings() {
  try {
    const settings = await prisma.agentSettings.findUnique({ where: { id: "default" } });
    if (!settings) return environmentSettings();
    return { ...settings, source: "database" as const };
  } catch {
    return environmentSettings();
  }
}

export async function updateAgentSettings(input: Omit<AgentSettings, "source">) {
  const settings = await prisma.agentSettings.upsert({ where: { id: "default" }, create: { id: "default", ...input }, update: input });
  return { ...settings, source: "database" as const };
}
