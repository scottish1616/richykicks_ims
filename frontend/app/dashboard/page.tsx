"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import NavBar from "../../components/NavBar";
import type {
  DashboardSummary,
  StaffDashboardSummary,
  ReceivingSession,
  Sale,
} from "../../types";

export default function Page() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
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
        {user.role === "admin" ? (
          <AdminDashboard name={user.name} />
        ) : (
          <StaffDashboard name={user.name} />
        )}

        <footer className="mt-12 flex justify-end">
          <p className="text-xs text-soft-gray">
            2026 &copy; Designed by{" "}
            <span className="font-semibold" style={{ color: "#D4AF37" }}>
              LEVITES SOLUTIONS
            </span>
          </p>
        </footer>
      </main>
    </>
  );
}

function AdminDashboard({ name }: { name: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sessions, setSessions] = useState<ReceivingSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<DashboardSummary>("/api/reports/dashboard"),
      apiFetch<ReceivingSession[]>("/api/stock/sessions"),
    ])
      .then(([summaryData, sessionsData]) => {
        setSummary(summaryData);
        setSessions(sessionsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, []);

  const activeSession = sessions.find(
    (s) => s.status === "open" || s.status === "staff_completed"
  );
  const awaitingReviewCount = sessions.filter(
    (s) => s.status === "staff_completed" || s.status === "closed"
  ).length;
  const recentFinalized = sessions
    .filter((s) => s.status === "approved" || s.status === "rejected")
    .slice(0, 5);

  const cards = summary
    ? [
        { label: "Total Products", value: summary.total_products },
        { label: "In Stock", value: summary.in_stock },
        { label: "Out of Stock", value: summary.out_of_stock },
        { label: "Today's Sales", value: `KSh ${Number(summary.todays_sales).toLocaleString()}` },
        { label: "This Month", value: `KSh ${Number(summary.this_month).toLocaleString()}` },
        { label: "Last Month", value: `KSh ${Number(summary.last_month).toLocaleString()}` },
      ]
    : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ivory">Dashboard</h1>
      <p className="mt-1 text-soft-gray">Welcome back, {name}</p>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
            <p className="text-sm text-soft-gray">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-ivory">{card.value}</p>
          </div>
        ))}
        {!summary && !error && <p className="text-soft-gray">Loading dashboard numbers...</p>}
      </div>

      <h2 className="mt-10 text-sm font-medium text-soft-gray">Receiving</h2>
      <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
          <p className="text-sm text-soft-gray">Active Session</p>
          <p className="mt-2 text-lg font-semibold text-ivory">
            {activeSession ? activeSession.status.replace("_", " ") : "None"}
          </p>
        </div>
        <div className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
          <p className="text-sm text-soft-gray">Awaiting Your Review</p>
          <p className="mt-2 text-lg font-semibold text-gold">{awaitingReviewCount}</p>
        </div>
        <div className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
          <p className="text-sm text-soft-gray">Recently Finalized</p>
          <p className="mt-2 text-lg font-semibold text-ivory">{recentFinalized.length}</p>
        </div>
      </div>

      {recentFinalized.length > 0 && (
        <div className="mt-4 space-y-2">
          {recentFinalized.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-md border border-soft-gray/10 bg-midnight px-4 py-2 text-sm"
            >
              <span className="text-soft-gray">Session {s.id.slice(0, 8)}</span>
              <span className={s.status === "approved" ? "text-success" : "text-error"}>
                {s.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function StaffDashboard({ name }: { name: string }) {
  const [summary, setSummary] = useState<StaffDashboardSummary | null>(null);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [sessions, setSessions] = useState<ReceivingSession[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<StaffDashboardSummary>("/api/reports/dashboard/staff"),
      apiFetch<Sale[]>("/api/sales/my-sales"),
      apiFetch<ReceivingSession[]>("/api/stock/sessions"),
    ])
      .then(([summaryData, salesData, sessionsData]) => {
        setSummary(summaryData);
        setRecentSales(salesData.slice(0, 5));
        setSessions(sessionsData);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard"));
  }, []);

  const activeSession = sessions.find(
    (s) => s.status === "open" || s.status === "staff_completed"
  );

  const cards = summary
    ? [
        { label: "My Sales Today", value: `KSh ${Number(summary.todays_sales).toLocaleString()}` },
        { label: "My Items Sold Today", value: summary.todays_items_sold },
        {
          label: "My Sales This Month",
          value: `KSh ${Number(summary.this_month_sales).toLocaleString()}`,
        },
        { label: "My Items Sold This Month", value: summary.this_month_items_sold },
      ]
    : [];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="text-2xl font-semibold text-ivory">My Dashboard</h1>
      <p className="mt-1 text-soft-gray">Welcome back, {name}</p>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-soft-gray/20 bg-charcoal p-5">
            <p className="text-sm text-soft-gray">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-ivory">{card.value}</p>
          </div>
        ))}
        {!summary && !error && <p className="text-soft-gray">Loading your numbers...</p>}
      </div>

      {activeSession && (
        <div className="mt-8 rounded-lg border border-gold/40 bg-charcoal p-5">
          <p className="text-sm text-soft-gray">Active Receiving Session</p>
          <p className="mt-1 text-ivory">
            Status: <span className="text-gold">{activeSession.status.replace("_", " ")}</span>
          </p>
          <a href="/receiving" className="mt-2 inline-block text-sm text-gold hover:underline">
            Go to Receiving &rarr;
          </a>
        </div>
      )}

      <h2 className="mt-10 text-sm font-medium text-soft-gray">Recent Sales</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-soft-gray/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-charcoal text-soft-gray">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Qty</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {recentSales.map((s) => (
              <tr key={s.id} className="border-t border-soft-gray/10">
                <td className="px-4 py-3 text-ivory">{s.product_name}</td>
                <td className="px-4 py-3 text-soft-gray">{s.quantity}</td>
                <td className="px-4 py-3 text-gold">
                  KSh {Number(s.total_amount).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-soft-gray">
                  {new Date(s.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {recentSales.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-soft-gray">
                  No sales yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}