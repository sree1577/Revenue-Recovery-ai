import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { CaseIntelligence } from "@/components/case-intelligence";
import "../../case.css";

type CasePageProps = {
  params: Promise<{ id: string }>;
};

export default async function CasePage({ params }: CasePageProps) {
  const { id } = await params;

  return (
    <AppShell activePath="/recovery-queue">
      <header><div><em>CASE INTELLIGENCE</em><h1>Case {id}</h1><p>This case is not available because recovery cases are not persisted yet.</p></div><Link href="/recovery-queue" className="button outline">← Recovery Queue</Link></header>
      <CaseIntelligence caseId={id} />
    </AppShell>
  );
}
