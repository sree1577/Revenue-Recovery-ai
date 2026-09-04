import { listRecoveryCases } from "@/lib/recovery-cases";

export async function GET() {
  const result = await listRecoveryCases();
  return Response.json({ success: true, data: result, error: null });
}
