"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import NavBar from "../../components/NavBar";

interface AuditLogEntry {
  id: string;
  event_type: string;
  user_id: string | null;
  resource: string | null;
  result: string;
  log_metadata: Record<string, unknown> | null;
  created_at: string;
}

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audit log is Admin-only end to end (PRD section 31). Backend
  // rejects Staff on this route regardless - this redirect just avoids
  // landing a Staff account on a page that can only ever error.
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      apiFetch<AuditLogEntry[]>("/api/audit-logs?limit=200")
        .then(setLogs)
        .catch((err) =>
          setError(err instanceof Error ? err.message : "Failed to load audit log")
        )
        .finally(() => setLoading(false));
    }
  }, [authLoading, user]);

  if (authLoading || !user || user.role !== "admin" || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-soft-gray">Loading...</p>
      </main>
    );
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ivory">Audit Log</h1>
        <p className="mt-1 text-soft-gray">
          Read-only record of sensitive actions across the system. Most recent first.
        </p>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}

        <div className="mt-6 overflow-x-auto rounded-lg border border-soft-gray/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-charcoal text-soft-gray">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Resource</th>
                <th className="px-4 py-3 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-soft-gray/10 align-top">
                  <td className="px-4 py-3 whitespace-nowrap text-soft-gray">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ivory">{log.event_type}</td>
                  <td className="px-4 py-3 text-soft-gray">
                    {log.user_id ? log.user_id.slice(0, 8) : "-"}
                  </td>
                  <td className="px-4 py-3 text-soft-gray">{log.resource ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        log.result === "success"
                          ? "rounded-full bg-success/20 px-2 py-1 text-xs text-success"
                          : "rounded-full bg-error/20 px-2 py-1 text-xs text-error"
                      }
                    >
                      {log.result}
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-soft-gray">
                    No audit events recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
