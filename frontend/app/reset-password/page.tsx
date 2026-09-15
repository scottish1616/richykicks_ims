"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/auth/password-reset/confirm", {
        method: "POST",
        body: JSON.stringify({ token, new_password: password }),
      });
      setDone(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-sm rounded-lg border border-soft-gray/20 bg-charcoal p-8 text-center">
          <p className="text-sm text-error">
            This reset link is missing its token. Request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-sm text-gold hover:underline"
          >
            Request password reset
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-soft-gray/20 bg-charcoal p-8">
        <h1 className="text-xl font-semibold text-ivory">
          Richy<span className="text-gold">Kicks</span>
        </h1>
        <p className="mt-1 text-sm text-soft-gray">Set a new password</p>

        {done ? (
          <p className="mt-6 text-sm text-success">
            Password reset. Redirecting you to login...
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm text-soft-gray">
                New Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-soft-gray">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
              />
            </div>

            {error && <p className="text-sm text-error">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Resetting..." : "Reset Password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
