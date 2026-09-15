"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import type { Product, Sale } from "../../types";

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [productsData, salesData] = await Promise.all([
        apiFetch<Product[]>("/api/products"),
        apiFetch<Sale[]>(isAdmin ? "/api/sales" : "/api/sales/my-sales"),
      ]);
      setProducts(productsData);
      setSales(salesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  if (authLoading || !user || loading) {
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
        <h1 className="text-2xl font-semibold text-ivory">Sales</h1>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}

        <RecordSaleForm products={products} onRecorded={() => loadData()} />

        <h2 className="mt-8 text-sm font-medium text-soft-gray">
          {isAdmin ? "All Sales" : "My Sales"}
        </h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-soft-gray/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-charcoal text-soft-gray">
              <tr>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Colour</th>
                <th className="px-4 py-3 font-medium">Size</th>
                <th className="px-4 py-3 font-medium">Qty</th>
                <th className="px-4 py-3 font-medium">Listed Price</th>
                <th className="px-4 py-3 font-medium">Paid</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-t border-soft-gray/10">
                  <td className="px-4 py-3 text-ivory">{s.product_name}</td>
                  <td className="px-4 py-3 text-soft-gray">{s.colour || "\u2014"}</td>
                  <td className="px-4 py-3 text-soft-gray">{s.size || "\u2014"}</td>
                  <td className="px-4 py-3 text-soft-gray">{s.quantity}</td>
                  <td className="px-4 py-3 text-soft-gray">
                    KSh {Number(s.listed_price_at_sale).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-ivory">
                    KSh {Number(s.actual_price_paid).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-gold">
                    KSh {Number(s.total_amount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-soft-gray">
                    {new Date(s.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-soft-gray">
                    No sales yet.
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

function RecordSaleForm({
  products,
  onRecorded,
}: {
  products: Product[];
  onRecorded: () => void;
}) {
  // Cascading selection: Product -> Colour -> Size, matching how stock
  // is actually tracked (per colour+size variant).
  const sellable = useMemo(() => products.filter((p) => p.variants.length > 0), [products]);

  const [productId, setProductId] = useState(sellable[0]?.id ?? "");
  const [colour, setColour] = useState<string | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [actualPrice, setActualPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = sellable.find((p) => p.id === productId) ?? null;

  const colours = useMemo(() => {
    if (!selectedProduct) return [];
    return Array.from(new Set(selectedProduct.variants.map((v) => v.colour)));
  }, [selectedProduct]);

  const sizesForColour = useMemo(() => {
    if (!selectedProduct || colour === null) return [];
    return selectedProduct.variants.filter((v) => v.colour === colour);
  }, [selectedProduct, colour]);

  const selectedVariant = useMemo(() => {
    if (!selectedProduct || colour === null || size === null) return null;
    return (
      selectedProduct.variants.find((v) => v.colour === colour && v.size === size) ?? null
    );
  }, [selectedProduct, colour, size]);

  useEffect(() => {
    if (sellable.length > 0 && !productId) {
      setProductId(sellable[0].id);
    }
  }, [sellable, productId]);

  useEffect(() => {
    // Reset colour/size whenever the product changes.
    setColour(colours[0] ?? null);
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSize(sizesForColour[0]?.size ?? null);
  }, [colour]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedVariant) return;
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          product_variant_id: selectedVariant.id,
          quantity: Number(quantity),
          actual_price_paid: actualPrice,
        }),
      });
      setQuantity("1");
      setActualPrice("");
      onRecorded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record sale");
    } finally {
      setSubmitting(false);
    }
  }

  if (sellable.length === 0) {
    return (
      <p className="mt-4 text-sm text-soft-gray">
        No products have stock yet - receive some stock first (Receiving page).
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-soft-gray/20 bg-charcoal p-6 sm:grid-cols-2 lg:grid-cols-5"
    >
      <div>
        <label className="block text-sm text-soft-gray">Product</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        >
          {sellable.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-soft-gray">Colour</label>
        <select
          value={colour ?? ""}
          onChange={(e) => setColour(e.target.value)}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        >
          {colours.map((c) => (
            <option key={c} value={c}>
              {c || "(no colour)"}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-soft-gray">Size</label>
        <select
          value={size ?? ""}
          onChange={(e) => setSize(e.target.value)}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        >
          {sizesForColour.map((v) => (
            <option key={v.id} value={v.size}>
              {v.size || "(no size)"} - {v.stock_quantity} in stock
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-soft-gray">Quantity</label>
        <input
          type="number"
          min="1"
          max={selectedVariant?.stock_quantity ?? undefined}
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        />
      </div>

      <div>
        <label className="block text-sm text-soft-gray">
          Actual Price Paid (KSh)
          {selectedProduct && (
            <span className="ml-1 text-xs text-soft-gray">
              (listed: {Number(selectedProduct.listed_price).toLocaleString()})
            </span>
          )}
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={actualPrice}
          onChange={(e) => setActualPrice(e.target.value)}
          placeholder={selectedProduct ? String(selectedProduct.listed_price) : ""}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        />
      </div>

      {selectedVariant && selectedVariant.stock_quantity === 0 && (
        <p className="text-sm text-error sm:col-span-2 lg:col-span-5">
          This colour/size is out of stock.
        </p>
      )}
      {error && <p className="text-sm text-error sm:col-span-2 lg:col-span-5">{error}</p>}

      <div className="sm:col-span-2 lg:col-span-5">
        <Button
          type="submit"
          disabled={submitting || !selectedVariant || selectedVariant.stock_quantity === 0}
        >
          {submitting ? "Recording..." : "Record Sale"}
        </Button>
      </div>
    </form>
  );
}