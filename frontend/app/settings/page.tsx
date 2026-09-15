"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";

interface ShopSettings {
  id: number;
  shop_name: string;
  address: string | null;
  phone: string | null;
  contact_email: string | null;
  updated_at: string;
}

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [shopName, setShopName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (!authLoading && user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!authLoading && user?.role === "admin") {
      apiFetch<ShopSettings>("/api/settings")
        .then((data) => {
          setSettings(data);
          setShopName(data.shop_name ?? "");
          setAddress(data.address ?? "");
          setPhone(data.phone ?? "");
          setContactEmail(data.contact_email ?? "");
        })
        .catch((err) => setError(err instanceof Error ? err.message : "Failed to load settings"))
        .finally(() => setLoading(false));
    }
  }, [authLoading, user]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await apiFetch<ShopSettings>("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          shop_name: shopName,
          address: address || null,
          phone: phone || null,
          contact_email: contactEmail || null,
        }),
      });
      setSettings(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
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
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-ivory">Settings</h1>
        <p className="mt-1 text-sm text-soft-gray">
          Basic shop information. Security and session configuration stay in
          backend environment variables and aren&apos;t editable here.
        </p>

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-4 rounded-lg border border-soft-gray/20 bg-charcoal p-6"
        >
          <div>
            <label className="block text-sm text-soft-gray">Shop Name</label>
            <input
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-sm text-soft-gray">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-sm text-soft-gray">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="block text-sm text-soft-gray">Contact Email</label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}
          {saved && <p className="text-sm text-success">Settings saved.</p>}

          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </form>

        {settings && (
          <p className="mt-4 text-xs text-soft-gray">
            Last updated {new Date(settings.updated_at).toLocaleString()}
          </p>
        )}
      </main>
    </>
  );
}