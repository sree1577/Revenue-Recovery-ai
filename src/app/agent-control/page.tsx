import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AgentControl } from "@/components/agent-control";
import "../agent.css";

export default function AgentControlPage() {
  return (
    <AppShell activePath="/agent-control">
      <header><div><em>AGENT OPERATIONS</em><h1>Agent Control</h1><p>Manual controls and policy settings will be connected to persistence next.</p></div><Link href="/" className="button outline">← Command Center</Link></header>
      <AgentControl />
    </AppShell>
  );
}
