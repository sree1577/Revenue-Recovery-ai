import Link from "next/link";
import type { ReactNode } from "react";

const navigation = [
  { href: "/", label: "Command Center", icon: "▦" },
  { href: "/recovery-queue", label: "Recovery Queue", icon: "☷" },
  { href: "/import", label: "Import Transactions", icon: "↑" },
  { href: "/agent-control", label: "Agent Control", icon: "✦" },
  { href: "/audit", label: "Audit & Safety", icon: "♢" },
  { href: "/integrations", label: "Integrations", icon: "⌘" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

type AppShellProps = {
  activePath: string;
  children: ReactNode;
};

export function AppShell({ activePath, children }: AppShellProps) {
  return (
    <main className="shell">
      <aside>
        <div className="brand"><i>R</i> Recover<b>AI</b></div>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link
              href={item.href}
              className={activePath === item.href ? "on" : undefined}
              aria-current={activePath === item.href ? "page" : undefined}
              key={item.href}
            >
              {item.icon} {item.label}
            </Link>
          ))}
        </nav>
        <div className="merchant">
          <small>DEMO MERCHANT</small>
          <strong>RevenueRecoverAI</strong>
          <span className="merchant-mode">Razorpay Test Mode</span>
        </div>
      </aside>
      <section className="content">{children}</section>
    </main>
  );
}
