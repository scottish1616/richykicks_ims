"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import Button from "../../components/Button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const expired = searchParams.get("expired") === "1";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-soft-gray/20 bg-charcoal p-8"
      >
        <h1 className="text-xl font-semibold text-ivory">
          Richy<span className="text-gold">Kicks</span>
        </h1>
        <p className="mt-1 text-sm text-soft-gray">Sign in to your account</p>

        {expired && (
          <p className="mt-4 rounded-md bg-gold/10 px-3 py-2 text-sm text-gold">
            Your session expired. Please log in again.
          </p>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm text-soft-gray">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm text-soft-gray">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}

        <Button type="submit" disabled={submitting} className="mt-6 w-full">
          {submitting ? "Signing in..." : "Login"}
        </Button>

        <p className="mt-4 text-center text-sm text-soft-gray">
          <Link href="/forgot-password" className="text-gold hover:underline">
            Forgot password?
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}