import Link from "next/link";
import { CsvImportFlow } from "@/components/csv-import-flow";
import { AppShell } from "@/components/app-shell";
import "../import.css";

export default function ImportPage() {
  return (
    <AppShell activePath="/import">
      <header>
        <div><em>DATA INGESTION</em><h1>Import Transactions</h1><p>Validate failed payments before creating recovery cases.</p></div>
        <Link href="/" className="button outline">← Command Center</Link>
      </header>
      <CsvImportFlow />
    </AppShell>
  );
}
