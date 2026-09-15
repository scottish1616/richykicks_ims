"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/auth/password-change", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  }

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
        <h1 className="text-2xl font-semibold text-ivory">My Account</h1>
        <p className="mt-1 text-soft-gray">
          {user.name} ({user.role}) - {user.email}
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 grid max-w-md grid-cols-1 gap-4 rounded-lg border border-soft-gray/20 bg-charcoal p-6"
        >
          <h2 className="text-sm font-medium text-soft-gray">Change Password</h2>

          <div>
            <label className="block text-sm text-soft-gray">Current Password</label>
            <input
              required
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-sm text-soft-gray">New Password</label>
            <input
              required
              type="password"
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-sm text-soft-gray">Confirm New Password</label>
            <input
              required
              type="password"
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}
          {success && !error && (
            <p className="text-sm text-success">Password changed successfully.</p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Change Password"}
          </Button>
        </form>
      </main>
    </>
  );
}