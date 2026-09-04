import { RecoveryCaseStatus, TransactionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type DashboardData = {
  demo: boolean;
  metrics: {
    revenueAtRiskPaise: number;
    revenueRecoveredPaise: number;
    recoveryRate: number;
    openCases: number;
    awaitingApproval: number;
    safetyInterventions: number;
    averageRecoveryHours: number;
    recoveredCases: number;
  };
  trend: { label: string; recoveredPaise: number; atRiskPaise: number }[];
  status: { label: string; count: number }[];
  failureReasons: { label: string; count: number }[];
};

const demoData: DashboardData = {
  demo: true,
  metrics: { revenueAtRiskPaise: 18250000, revenueRecoveredPaise: 4785000, recoveryRate: 26.2, openCases: 43, awaitingApproval: 2, safetyInterventions: 7, averageRecoveryHours: 9.4, recoveredCases: 11 },
  trend: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, index) => ({ label, recoveredPaise: [320000, 490000, 610000, 420000, 780000, 690000, 865000][index], atRiskPaise: [1200000, 1500000, 1100000, 1800000, 1400000, 900000, 1250000][index] })),
  status: [{ label: "Analyzed", count: 18 }, { label: "Approval", count: 7 }, { label: "Scheduled", count: 12 }, { label: "Stopped", count: 6 }],
  failureReasons: [{ label: "UPI expired", count: 17 }, { label: "Bank timeout", count: 11 }, { label: "Card decline", count: 8 }, { label: "Other", count: 7 }],
};

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const cases = await prisma.recoveryCase.findMany({ include: { transaction: true } });
    if (cases.length === 0) return demoData;
    const recovered = cases.filter((item) => item.status === RecoveryCaseStatus.RECOVERED);
    const active = cases.filter((item) => item.status !== RecoveryCaseStatus.RECOVERED && item.status !== RecoveryCaseStatus.STOPPED && item.status !== RecoveryCaseStatus.EXPIRED);
    const atRiskPaise = active.reduce((sum, item) => sum + item.transaction.amountPaise, 0);
    const recoveredPaise = recovered.reduce((sum, item) => sum + (item.recoveredAmountPaise ?? 0), 0);
    const completedValue = atRiskPaise + recoveredPaise;
    const averageRecoveryHours = recovered.length === 0 ? 0 : Number((recovered.reduce((sum, item) => sum + ((item.recoveredAt?.getTime() ?? item.updatedAt.getTime()) - item.createdAt.getTime()) / 3_600_000, 0) / recovered.length).toFixed(1));
    const statusCounts = new Map<string, number>();
    const failureCounts = new Map<string, number>();
    for (const item of cases) {
      statusCounts.set(item.status, (statusCounts.get(item.status) ?? 0) + 1);
      failureCounts.set(item.failureCategory, (failureCounts.get(item.failureCategory) ?? 0) + 1);
    }
    return {
      demo: false,
      metrics: { revenueAtRiskPaise: atRiskPaise, revenueRecoveredPaise: recoveredPaise, recoveryRate: completedValue === 0 ? 0 : Number((recoveredPaise / completedValue * 100).toFixed(1)), openCases: active.length, awaitingApproval: cases.filter((item) => item.status === RecoveryCaseStatus.AWAITING_APPROVAL).length, safetyInterventions: cases.filter((item) => item.status === RecoveryCaseStatus.STOPPED || item.status === RecoveryCaseStatus.ESCALATED).length, averageRecoveryHours, recoveredCases: recovered.length },
      trend: [],
      status: [...statusCounts.entries()].map(([label, count]) => ({ label: label.replaceAll("_", " "), count })),
      failureReasons: [...failureCounts.entries()].map(([label, count]) => ({ label: label.replaceAll("_", " "), count })),
    };
  } catch {
    return demoData;
  }
}

export { TransactionStatus };
