"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";

export default function Page() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ message: string }>("/api/auth/password-reset/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-lg border border-soft-gray/20 bg-charcoal p-8">
        <h1 className="text-xl font-semibold text-ivory">
          Richy<span className="text-gold">Kicks</span>
        </h1>
        <p className="mt-1 text-sm text-soft-gray">Reset your password</p>

        {message ? (
          <div className="mt-6">
            <p className="text-sm text-success">{message}</p>
            <Link href="/login" className="mt-4 inline-block text-sm text-gold hover:underline">
              &larr; Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6">
            <label htmlFor="email" className="block text-sm text-soft-gray">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />

            {error && <p className="mt-3 text-sm text-error">{error}</p>}

            <Button type="submit" disabled={submitting} className="mt-6 w-full">
              {submitting ? "Sending..." : "Send Reset Link"}
            </Button>

            <Link
              href="/login"
              className="mt-4 block text-center text-sm text-soft-gray hover:text-ivory"
            >
              &larr; Back to login
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
