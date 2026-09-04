import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

import { generateGroqMessage } from "../src/lib/ai/groq";

async function main() {
  console.log("=== Groq Integration Test ===");

  console.log(
    "GROQ_API_KEY:",
    process.env.GROQ_API_KEY ? "Configured ✅" : "Missing ❌"
  );

  console.log(
    "GROQ_MODEL:",
    process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"
  );

  console.log("\nSending test recovery message to Groq...");

  const result = await generateGroqMessage({
    customerName: "Aarav Kumar",
    failureCategory: "UPI_REQUEST_EXPIRED",
    recommendedAction: "CREATE_PAYMENT_LINK",
    amountPaise: 249900,
    consentAvailable: true,
    paymentConfirmed: false,
  });

  if (!result) {
    console.error("\n❌ Groq returned null.");
    process.exitCode = 1;
    return;
  }

  console.log("\n✅ GROQ LIVE INTEGRATION SUCCESSFUL");

  console.log("\nCustomer Message:");
  console.log(result.customerMessage);

  console.log("\nCase Summary:");
  console.log(result.caseSummary);

  console.log("\nFailure Explanation:");
  console.log(result.failureExplanation);
}

main().catch((error) => {
  console.error("\n❌ Groq test crashed:");
  console.error(error);
  process.exitCode = 1;
});