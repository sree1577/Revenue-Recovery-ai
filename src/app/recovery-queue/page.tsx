import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { RecoveryQueue } from "@/components/recovery-queue";
import "../recovery-queue.css";

export default function RecoveryQueuePage() {
  return (
    <AppShell activePath="/recovery-queue">
      <header><div><em>RECOVERY OPERATIONS</em><h1>Recovery Queue</h1><p>AI-prioritized failed payments ranked by recovery probability, value, and urgency.</p></div><Link href="/import" className="button">↑ Import Transactions</Link></header>
      <RecoveryQueue />
    </AppShell>
  );
}
