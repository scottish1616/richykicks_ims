"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import type { User } from "../../types";

const MAX_ACTIVE_STAFF = 2;

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [staff, setStaff] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    } else if (!authLoading && user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [authLoading, user, router]);

  async function loadStaff() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<User[]>("/api/staff");
      setStaff(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      loadStaff();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const activeCount = staff.filter((s) => s.is_active).length;

  async function toggleActive(target: User) {
    setError(null);
    setActioningId(target.id);
    const path = "/api/staff/" + target.id + "/" + (target.is_active ? "disable" : "enable");
    try {
      await apiFetch(path, { method: "POST" });
      await loadStaff();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update staff account");
    } finally {
      setActioningId(null);
    }
  }

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
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ivory">Staff</h1>
          <span className="text-sm text-soft-gray">
            {activeCount} of {MAX_ACTIVE_STAFF} active slots used
          </span>
        </div>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}

        <CreateStaffForm activeCount={activeCount} onCreated={() => loadStaff()} />

        <div className="mt-8 overflow-x-auto rounded-lg border border-soft-gray/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-charcoal text-soft-gray">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-soft-gray/10">
                  <td className="px-4 py-3 text-ivory">{s.name}</td>
                  <td className="px-4 py-3 text-soft-gray">{s.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.is_active
                          ? "rounded-full bg-success/20 px-2 py-1 text-xs text-success"
                          : "rounded-full bg-error/20 px-2 py-1 text-xs text-error"
                      }
                    >
                      {s.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-soft-gray">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant={s.is_active ? "danger" : "secondary"}
                      disabled={
                        actioningId === s.id ||
                        (!s.is_active && activeCount >= MAX_ACTIVE_STAFF)
                      }
                      onClick={() => toggleActive(s)}
                    >
                      {actioningId === s.id
                        ? "Working..."
                        : s.is_active
                          ? "Disable"
                          : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))}
              {staff.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-soft-gray">
                    No staff accounts yet.
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

function CreateStaffForm({
  activeCount,
  onCreated,
}: {
  activeCount: number;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atCap = activeCount >= MAX_ACTIVE_STAFF;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/staff", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setName("");
      setEmail("");
      setPassword("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create staff account");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-soft-gray/20 bg-charcoal p-6 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label className="block text-sm text-soft-gray">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={atCap}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-sm text-soft-gray">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={atCap}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-sm text-soft-gray">Password</label>
        <input
          required
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={atCap}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold disabled:opacity-50"
        />
      </div>
      <div className="flex items-end">
        <Button type="submit" disabled={submitting || atCap} className="w-full">
          {atCap ? "Max staff reached" : submitting ? "Creating..." : "Create Staff"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-error sm:col-span-2 lg:col-span-4">{error}</p>
      )}
      {atCap && !error && (
        <p className="text-xs text-soft-gray sm:col-span-2 lg:col-span-4">
          {MAX_ACTIVE_STAFF} active Staff accounts already exist. Disable one to free a slot.
        </p>
      )}
    </form>
  );
}