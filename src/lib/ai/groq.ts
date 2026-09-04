import Groq from "groq-sdk";
import {
  recoveryMessageSchema,
  type RecoveryMessage,
} from "@/lib/ai/schemas";

type MessageInput = {
  customerName: string;
  failureCategory: string;
  recommendedAction: string;
  amountPaise: number;
  consentAvailable: boolean;
  paymentConfirmed: boolean;
};

const systemPrompt = `
You write concise customer recovery copy for a merchant payment recovery system.

Return valid JSON only with exactly these keys:
- customerMessage
- caseSummary
- failureExplanation

Rules:
- Use only the supplied facts.
- Never request OTP, CVV, PIN, passwords, or card details.
- Never claim a payment succeeded unless paymentConfirmed is true.
- Never pressure or threaten the customer.
- Never contact an opted-out customer.
- Do not expose technical bank error codes to the customer.
- If paymentConfirmed is false, do not imply that payment was successful.
- Keep the customer message professional, helpful, and concise.

Return JSON only.
`;

export async function generateGroqMessage(
  input: MessageInput
): Promise<RecoveryMessage | null> {
  // No API key → deterministic fallback can be used by caller
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ: GROQ_API_KEY is not configured.");
    return null;
  }

  // Do not generate customer communication without consent
  if (!input.consentAvailable) {
    console.warn(
      "GROQ: Message generation skipped because customer consent is unavailable."
    );
    return null;
  }

  const model =
    process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";

  const client = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 500,

      response_format: {
        type: "json_object",
      },

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: JSON.stringify({
            customerName: input.customerName,
            failureCategory: input.failureCategory,
            recommendedAction: input.recommendedAction,
            amountPaise: input.amountPaise,
            amountRupees: input.amountPaise / 100,
            consentAvailable: input.consentAvailable,
            paymentConfirmed: input.paymentConfirmed,
          }),
        },
      ],
    });

    const content =
      completion.choices[0]?.message?.content;

    if (!content) {
      console.error("GROQ: API returned empty content.");
      return null;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      console.error("GROQ: Invalid JSON response.");

      if (process.env.NODE_ENV !== "production") {
        console.error(error);
        console.error("Raw Groq response:", content);
      }

      return null;
    }

    const result =
      recoveryMessageSchema.safeParse(parsed);

    if (!result.success) {
      console.error(
        "GROQ: Response failed Zod validation."
      );

      if (process.env.NODE_ENV !== "production") {
        console.dir(result.error.issues, {
          depth: null,
        });

        console.error("Parsed Groq response:");
        console.dir(parsed, {
          depth: null,
        });
      }

      return null;
    }

    return result.data;
  } catch (error) {
    console.error("GROQ: API request failed.");

    if (error instanceof Error) {
      console.error("Error:", error.message);
    } else {
      console.error(error);
    }

    return null;
  }
}