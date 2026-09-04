import { getDashboardData } from "@/lib/dashboard";

export async function GET() {
  const data = await getDashboardData();
  return Response.json({ success: true, data, error: null });
}
