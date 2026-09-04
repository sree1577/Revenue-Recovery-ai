import Papa from "papaparse";
import { z } from "zod";

export const MAX_CSV_SIZE = 2_000_000;

export const requiredCsvColumns = [
  "transaction_id",
  "customer_name",
  "email",
  "phone",
  "amount_rupees",
  "payment_method",
  "failure_reason",
  "error_code",
  "error_step",
  "error_source",
  "attempts",
  "previous_successes",
  "consent_email",
  "consent_sms",
  "consent_whatsapp",
  "occurred_at",
] as const;

const paymentMethods = ["UPI", "Card", "Netbanking"] as const;
const failureReasons = [
  "UPI_REQUEST_EXPIRED",
  "INCORRECT_OTP",
  "BANK_TIMEOUT",
  "INSUFFICIENT_FUNDS",
  "CARD_EXPIRED",
  "CARD_DECLINED",
  "CHECKOUT_ABANDONED",
  "SUBSCRIPTION_FAILED",
  "INVOICE_OVERDUE",
  "PAYMENT_REQUEST_EXPIRED",
  "CUSTOMER_CANCELLED",
  "SUSPECTED_FRAUD",
] as const;

const requiredText = z.string().trim().min(1);
const optionalText = z.string().trim().optional().or(z.literal(""));
const booleanText = z.enum(["true", "false"]).transform((value) => value === "true");

const rawRowSchema = z.object({
  transaction_id: requiredText,
  customer_name: requiredText,
  email: z.string().trim().email(),
  phone: requiredText,
  amount_rupees: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "must be a positive rupee amount with up to two decimals"),
  payment_method: z.enum(paymentMethods),
  failure_reason: z.enum(failureReasons),
  error_code: optionalText,
  error_step: optionalText,
  error_source: optionalText,
  attempts: z.string().trim().regex(/^\d+$/).transform(Number),
  previous_successes: z.string().trim().regex(/^\d+$/).transform(Number),
  consent_email: booleanText,
  consent_sms: booleanText,
  consent_whatsapp: booleanText,
  occurred_at: z.string().trim().datetime({ offset: true }),
});

export const normalizedImportRowSchema = z.object({
  externalTransactionId: requiredText,
  customerName: requiredText,
  email: z.string().email(),
  phone: requiredText,
  amountPaise: z.number().int().positive().safe(),
  paymentMethod: z.enum(paymentMethods),
  failureReason: z.enum(failureReasons),
  errorCode: z.string().optional(),
  errorStep: z.string().optional(),
  errorSource: z.string().optional(),
  attempts: z.number().int().nonnegative(),
  previousSuccesses: z.number().int().nonnegative(),
  consentEmail: z.boolean(),
  consentSms: z.boolean(),
  consentWhatsApp: z.boolean(),
  occurredAt: z.string().datetime({ offset: true }),
});

export type NormalizedImportRow = z.infer<typeof normalizedImportRowSchema>;

export type CsvImportResult = {
  rows: NormalizedImportRow[];
  errors: { row: number; message: string }[];
  duplicates: number;
  total: number;
};

function rupeesToPaise(value: string) {
  const [whole, fraction = ""] = value.split(".");
  const paise = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new Error("amount_rupees must be a positive safe monetary value");
  }
  return paise;
}

function normalizeHeaders(headers: string[]) {
  return headers.map((header) => header.trim().toLowerCase());
}

export function parseCsvText(text: string): CsvImportResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });
  const headers = normalizeHeaders(parsed.meta.fields ?? []);
  const missingColumns = requiredCsvColumns.filter((column) => !headers.includes(column));
  const errors: { row: number; message: string }[] = [];
  const rows: NormalizedImportRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  if (missingColumns.length > 0) {
    return {
      rows,
      errors: [{ row: 1, message: `Missing required columns: ${missingColumns.join(", ")}` }],
      duplicates,
      total: parsed.data.length,
    };
  }

  parsed.data.forEach((raw, index) => {
    const result = rawRowSchema.safeParse(raw);
    if (!result.success) {
      errors.push({
        row: index + 2,
        message: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      });
      return;
    }
    if (seen.has(result.data.transaction_id)) {
      duplicates++;
      return;
    }
    seen.add(result.data.transaction_id);
    try {
      rows.push({
        externalTransactionId: result.data.transaction_id,
        customerName: result.data.customer_name,
        email: result.data.email,
        phone: result.data.phone,
        amountPaise: rupeesToPaise(result.data.amount_rupees),
        paymentMethod: result.data.payment_method,
        failureReason: result.data.failure_reason,
        errorCode: result.data.error_code || undefined,
        errorStep: result.data.error_step || undefined,
        errorSource: result.data.error_source || undefined,
        attempts: result.data.attempts,
        previousSuccesses: result.data.previous_successes,
        consentEmail: result.data.consent_email,
        consentSms: result.data.consent_sms,
        consentWhatsApp: result.data.consent_whatsapp,
        occurredAt: result.data.occurred_at,
      });
    } catch (error) {
      errors.push({ row: index + 2, message: error instanceof Error ? error.message : "Invalid monetary value" });
    }
  });

  return { rows, errors, duplicates, total: parsed.data.length };
}

export function validateCsvFile(file: File) {
  if (file.size > MAX_CSV_SIZE) throw new Error("CSV must be smaller than 2 MB.");
  if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
    throw new Error("Please upload a CSV file.");
  }
  return parseCsvText;
}
