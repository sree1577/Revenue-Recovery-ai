"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type ImportRow = {
  externalTransactionId: string;
  customerName: string;
  amountPaise: number;
  paymentMethod: string;
  failureReason: string;
};

type Preview = {
  summary: { total: number; valid: number; invalid: number; duplicates: number };
  rows: ImportRow[];
  errors: { row: number; message: string }[];
};

export function CsvImportFlow() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState<"preview" | "commit" | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  async function previewFile() {
    if (!file) return;
    setLoading("preview");
    setMessage(null);
    setPreview(null);
    setConfirmed(false);
    const form = new FormData();
    form.append("file", file);
    try {
      const response = await fetch("/api/import/preview", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to preview this file.");
      setPreview(body.data);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to preview this file." });
    } finally {
      setLoading(null);
    }
  }

  async function commitImport() {
    if (!preview || !confirmed || preview.rows.length === 0) return;
    setLoading("commit");
    setMessage(null);
    try {
      const response = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rows }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.error?.message ?? "Unable to save this import.");
      setMessage({ type: "success", text: `${body.data.imported.length} recovery cases created. Opening the queue...` });
      window.setTimeout(() => router.push("/recovery-queue"), 700);
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "Unable to save this import." });
    } finally {
      setLoading(null);
    }
  }

  const canCommit = Boolean(preview && confirmed && preview.rows.length > 0 && preview.summary.invalid === 0);
  return (
    <section className="panel importer" aria-labelledby="import-title">
      <div className="title">
        <div><em>DATA INGESTION</em><h2 id="import-title">Import failed transactions</h2><p>Preview and validate rows before creating recovery cases.</p></div>
        <a className="download" href="/sample-failed-transactions.csv" download>↓ Download sample CSV</a>
      </div>
      <div className="importgrid">
        <div className="drop" onClick={() => input.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") input.current?.click(); }}>
          <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setMessage(null); }} />
          <b>↑</b><strong>{file ? file.name : "Drop or select your CSV file"}</strong><span>CSV only, maximum 2 MB</span>
          <button type="button" className="outline" onClick={(event) => { event.stopPropagation(); input.current?.click(); }}>Choose file</button>
        </div>
        <div className="requirements">
          <strong>Required CSV columns</strong>
          {["transaction_id", "customer_name", "email", "phone", "amount_rupees", "payment_method", "failure_reason", "attempts", "consent_email"].map((column) => <code key={column}>{column}</code>)}
          <button type="button" disabled={!file || loading !== null} onClick={previewFile}>{loading === "preview" ? "Validating..." : "Preview CSV"}</button>
          {preview && <label className="confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I confirm these validated rows should create recovery cases.</label>}
          <button type="button" disabled={!canCommit || loading !== null} onClick={commitImport}>{loading === "commit" ? "Saving..." : "Confirm & create cases"}</button>
        </div>
      </div>
      {message && <p className={message.type === "error" ? "error" : "success"} role="status">{message.text}</p>}
      {preview && <div className="summary"><Summary label="TOTAL ROWS" value={preview.summary.total} /><Summary label="VALID CASES" value={preview.summary.valid} className="good" /><Summary label="INVALID ROWS" value={preview.summary.invalid} className="bad" /><Summary label="DUPLICATES" value={preview.summary.duplicates} /><div className="preview-table"><strong>Preview</strong>{preview.rows.slice(0, 5).map((row) => <p key={row.externalTransactionId}>{row.externalTransactionId} · {row.customerName} · ₹{(row.amountPaise / 100).toLocaleString("en-IN")} · {row.failureReason}</p>)}</div>{preview.errors.length > 0 && <details><summary>View validation errors</summary>{preview.errors.map((error) => <p key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</p>)}</details>}</div>}
    </section>
  );
}

function Summary({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return <div><small>{label}</small><b className={className}>{value}</b></div>;
}
