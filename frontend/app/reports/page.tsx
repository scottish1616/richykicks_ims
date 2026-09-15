"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import type { PeriodReport } from "../../types";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_7_days", label: "Last 7 Days" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "custom", label: "Custom Range" },
];

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [period, setPeriod] = useState("today");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  async function runReport() {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { period };
      if (period === "custom") {
        body.start_date = startDate;
        body.end_date = endDate;
      }
      const data = await apiFetch<PeriodReport>(
        isAdmin ? "/api/reports/system-wide" : "/api/reports/my-sales",
        { method: "POST", body: JSON.stringify(body) }
      );
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user && period !== "custom") {
      runReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, period]);

  if (authLoading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-soft-gray">Loading...</p>
      </main>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ivory">
          {isAdmin ? "Reports" : "My Sales Report"}
        </h1>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm text-soft-gray">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {period === "custom" && (
            <>
              <div>
                <label className="block text-sm text-soft-gray">Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory"
                />
              </div>
              <div>
                <label className="block text-sm text-soft-gray">End</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory"
                />
              </div>
              <Button onClick={runReport} disabled={!startDate || !endDate}>
                Run Report
              </Button>
            </>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}
        {loading && <p className="mt-4 text-soft-gray">Loading...</p>}

        {report && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
              <p className="text-sm text-soft-gray">Revenue</p>
              <p className="mt-2 text-2xl font-semibold text-gold">
                KSh {Number(report.revenue).toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
              <p className="text-sm text-soft-gray">Units Sold</p>
              <p className="mt-2 text-2xl font-semibold text-ivory">{report.quantity_sold}</p>
            </div>
            <div className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
              <p className="text-sm text-soft-gray">Number of Sales</p>
              <p className="mt-2 text-2xl font-semibold text-ivory">{report.sale_count}</p>
            </div>
          </div>
        )}
      </main>
    </>
  );
}