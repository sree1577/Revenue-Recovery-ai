import { describe, expect, it } from "vitest";
import { parseCsvText } from "@/lib/import/csv";

const header = "transaction_id,customer_name,email,phone,amount_rupees,payment_method,failure_reason,error_code,error_step,error_source,attempts,previous_successes,consent_email,consent_sms,consent_whatsapp,occurred_at";
const row = "PAY-1,Test Customer,test@example.test,+919900000000,2499.50,UPI,UPI_REQUEST_EXPIRED,UPI_TIMEOUT,collect,bank,1,3,true,false,false,2026-09-01T10:00:00+05:30";

describe("CSV import validation", () => {
  it("accepts valid rows and converts rupees to paise", () => { const result = parseCsvText(`${header}\n${row}`); expect(result.errors).toHaveLength(0); expect(result.rows[0]?.amountPaise).toBe(249950); });
  it("rejects missing columns", () => expect(parseCsvText("transaction_id,customer_name\nPAY-1,Test").errors[0]?.message).toContain("Missing required columns"));
  it("rejects invalid monetary values", () => expect(parseCsvText(`${header}\n${row.replace("2499.50", "not-money")}`).errors.length).toBe(1));
  it("detects duplicate IDs within a file", () => { const result = parseCsvText(`${header}\n${row}\n${row}`); expect(result.duplicates).toBe(1); expect(result.rows).toHaveLength(1); });
  it("rejects unsupported payment methods", () => expect(parseCsvText(`${header}\n${row.replace(",UPI,", ",Wallet,")}`).errors.length).toBe(1));
});
