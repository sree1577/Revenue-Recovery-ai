import { listAuditEvents } from "@/lib/audit";

const allowedFilters = new Set(["ALL", "AGENT", "MERCHANT", "RAZORPAY", "CUSTOMER", "SYSTEM", "SAFETY", "ERROR"]);

export async function GET(request: Request) {
  const filter = new URL(request.url).searchParams.get("filter") ?? "ALL";
  const safeFilter = allowedFilters.has(filter) ? filter : "ALL";
  const result = await listAuditEvents(safeFilter);
  return Response.json({ success: true, data: result, error: null });
}
