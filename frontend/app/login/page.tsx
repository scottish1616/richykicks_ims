"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import Button from "../../components/Button";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
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
        <h1 className="flex items-center gap-2 text-xl font-semibold text-ivory">
          {!logoFailed && (
            <Image
              src="/richykicks-logo.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
              onError={() => setLogoFailed(true)}
            />
          )}
          <span>Richy<span className="text-gold">Kicks</span></span>
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
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 pr-20 text-ivory outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-2 flex items-center rounded p-1 text-gold hover:text-ivory focus:outline-none focus:ring-2 focus:ring-gold/50"
              >
                {showPassword ? (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 8.6 4.4 9.5 6-.4.7-1.3 2-2.7 3.3M6.2 6.2C4.3 7.4 3 9.2 2.5 11c.9 1.6 4.3 6 9.5 6 1 0 1.9-.2 2.8-.5" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12S5.9 5 12 5s9.5 7 9.5 7-3.4 7-9.5 7-9.5-7-9.5-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
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