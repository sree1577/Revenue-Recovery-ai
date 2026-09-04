"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type DashboardData = {
  demo: boolean;
  metrics: { revenueAtRiskPaise: number; revenueRecoveredPaise: number; recoveryRate: number; openCases: number; awaitingApproval: number; safetyInterventions: number; averageRecoveryHours: number; recoveredCases: number };
  trend: { label: string; recoveredPaise: number; atRiskPaise: number }[];
  status: { label: string; count: number }[];
  failureReasons: { label: string; count: number }[];
};

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function DashboardMetrics({ initialData }: { initialData: DashboardData }) {
  const [data] = useState<DashboardData>(initialData);
  const cards = [["Revenue at risk", money.format(data.metrics.revenueAtRiskPaise / 100), `${data.metrics.openCases} open cases`, "red"], ["Revenue recovered", money.format(data.metrics.revenueRecoveredPaise / 100), `${data.metrics.recoveredCases} successful cases`, "green"], ["Recovery rate", `${data.metrics.recoveryRate}%`, "Verified recovered value", "blue"], ["Safety interventions", String(data.metrics.safetyInterventions), `${data.metrics.awaitingApproval} awaiting approval`, "amber"]];
  return <>
    {data.demo && <p className="demo-note" role="status">Synthetic demo metrics are shown until database records are available.</p>}
    <div className="metrics">{cards.map(([label, value, note, color]) => <article className={`metric ${color}`} key={label}><p>{label}</p><strong>{value}</strong><small>{note}</small></article>)}</div>
    <div className="dashboard-charts"><article className="panel chart-card"><div className="title"><div><h2>Recovery trend</h2><p>Recovered and at-risk value</p></div></div><ResponsiveContainer width="100%" height={220}><LineChart data={data.trend}><CartesianGrid stroke="#eef0f4" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 10 }} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} /><Tooltip formatter={(value) => money.format(Number(value) / 100)} /><Line type="monotone" dataKey="recoveredPaise" name="Recovered" stroke="#20a45b" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="atRiskPaise" name="At risk" stroke="#f05c5c" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></article><article className="panel chart-card"><div className="title"><div><h2>Failure reasons</h2><p>Cases by diagnosis</p></div></div><ResponsiveContainer width="100%" height={220}><BarChart data={data.failureReasons} layout="vertical" margin={{ left: 20, right: 12 }}><CartesianGrid stroke="#eef0f4" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" name="Cases" fill="#3157e2" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></article></div>
  </>;
}
