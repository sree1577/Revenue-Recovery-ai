import { generateGroqMessage } from "@/lib/ai/groq";
import type { RecoveryMessage } from "@/lib/ai/schemas";

type MessageInput = {
  customerName: string;
  failureCategory: string;
  recommendedAction: string;
  amountPaise: number;
  consentAvailable: boolean;
  paymentConfirmed: boolean;
};

function fallbackMessage(input: MessageInput): RecoveryMessage {
  const amount = `₹${(input.amountPaise / 100).toLocaleString("en-IN")}`;
  if (input.paymentConfirmed) {
    return { customerMessage: "Your payment has already been confirmed. No further action is needed.", caseSummary: "Payment is confirmed; no recovery message is needed.", failureExplanation: "The payment record is already marked as confirmed." };
  }
  if (!input.consentAvailable) {
    return { customerMessage: "", caseSummary: "Customer contact is blocked because consent is unavailable.", failureExplanation: "The recovery policy does not allow customer contact without consent." };
  }
  return {
    customerMessage: `Hi ${input.customerName}, your payment of ${amount} was not completed. No payment has been confirmed. You can try again using a secure payment option when convenient.`,
    caseSummary: `${input.failureCategory.replaceAll("_", " ").toLowerCase()} recovery for ${amount}.`,
    failureExplanation: `The payment was not completed. The recommended next step is to ${input.recommendedAction.toLowerCase()}.`,
  };
}

export async function generateRecoveryMessage(input: MessageInput): Promise<{ message: RecoveryMessage; source: "groq" | "fallback" }> {
  const generated = await generateGroqMessage(input);
  return generated ? { message: generated, source: "groq" } : { message: fallbackMessage(input), source: "fallback" };
}
