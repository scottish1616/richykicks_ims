import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">
        Richy<span className="text-gold">Kicks</span>
      </h1>
      <p className="text-soft-gray">Inventory Management System</p>
      <Link
        href="/login"
        className="mt-4 rounded-md bg-royal-purple px-5 py-2 font-medium text-ivory transition-colors hover:bg-royal-purple-hover"
      >
        Go to Login
      </Link>
    </main>
  );
}
