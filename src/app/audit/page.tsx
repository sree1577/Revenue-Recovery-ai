import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AuditDashboard } from "@/components/audit-dashboard";
import "../audit.css";

export default function AuditPage() {
  return (
    <AppShell activePath="/audit">
      <header><div><em>CONTROL PLANE</em><h1>Audit &amp; Safety</h1><p>Decision and safety events will be recorded here once cases are persisted.</p></div><Link href="/" className="button outline">← Command Center</Link></header>
      <AuditDashboard />
    </AppShell>
  );
}
