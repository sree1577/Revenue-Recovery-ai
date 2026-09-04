import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { IntegrationStatus } from "@/components/integration-status";
import "../integrations.css";

export default function IntegrationsPage() {
  return (
    <AppShell activePath="/integrations">
      <header><div><em>SERVICE STATUS</em><h1>Integrations</h1><p>External services will be reported honestly as they are configured.</p></div><Link href="/" className="button outline">← Command Center</Link></header>
      <IntegrationStatus />
    </AppShell>
  );
}
