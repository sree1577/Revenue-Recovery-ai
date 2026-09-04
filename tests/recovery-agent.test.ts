import { describe, expect, it } from "vitest";
import { analyzeTransaction, type Transaction } from "@/lib/recovery-agent";

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return { id: "PAY-TEST", customer: "Test Customer", amount: 2499, method: "UPI", failureReason: "UPI_REQUEST_EXPIRED", attempts: 1, previousSuccesses: 4, consent: true, ...overrides };
}

describe("recovery decision engine", () => {
  it("recommends a fresh link for an expired UPI request", () => expect(analyzeTransaction(transaction()).action).toContain("fresh UPI"));
  it("delays bank timeout recovery", () => expect(analyzeTransaction(transaction({ failureReason: "BANK_TIMEOUT" })).delayMinutes).toBeGreaterThan(0));
  it("avoids an immediate insufficient-funds retry", () => expect(analyzeTransaction(transaction({ failureReason: "INSUFFICIENT_FUNDS" })).delayMinutes).toBeGreaterThanOrEqual(720));
  it("suggests another method for expired cards", () => expect(analyzeTransaction(transaction({ failureReason: "CARD_EXPIRED", method: "Card" })).action).toContain("UPI"));
  it("stops suspected fraud", () => { const decision = analyzeTransaction(transaction({ failureReason: "SUSPECTED_FRAUD" })); expect(decision.stopped).toBe(true); expect(decision.requiresApproval).toBe(true); });
  it("stops without consent", () => expect(analyzeTransaction(transaction({ consent: false })).stopped).toBe(true));
  it("stops an already paid transaction", () => expect(analyzeTransaction(transaction({ alreadyPaid: true })).stopped).toBe(true));
  it("stops after three attempts", () => expect(analyzeTransaction(transaction({ attempts: 3 })).stopped).toBe(true));
  it("requires approval for high-value cases", () => expect(analyzeTransaction(transaction({ amount: 10000 })).requiresApproval).toBe(true));
});
