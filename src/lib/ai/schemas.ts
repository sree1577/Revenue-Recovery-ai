import { z } from "zod";

export const recoveryMessageSchema = z.object({
  customerMessage: z.string().trim().min(1).max(1_000),
  caseSummary: z.string().trim().min(1).max(500),
  failureExplanation: z.string().trim().min(1).max(500),
});

export type RecoveryMessage = z.infer<
  typeof recoveryMessageSchema
>;