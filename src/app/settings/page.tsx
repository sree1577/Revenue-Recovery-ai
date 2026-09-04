import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AgentControl } from "@/components/agent-control";
import "../agent.css";

export default function SettingsPage() {
  return (
    <AppShell activePath="/settings">
      <header><div><em>WORKSPACE CONFIGURATION</em><h1>Settings</h1><p>Workspace and recovery preferences will be stored in a later phase.</p></div><Link href="/" className="button outline">← Command Center</Link></header>
      <AgentControl />
    </AppShell>
  );
}
