import { getIntegrationStatus } from "@/lib/integrations";

export async function GET() {
  return Response.json({ success: true, data: await getIntegrationStatus(), error: null });
}
