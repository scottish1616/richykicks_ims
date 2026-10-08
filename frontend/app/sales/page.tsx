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
                <th className="px-4 py-3 font-medium">Payment Type</th>
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
                  <td className="px-4 py-3 text-soft-gray">{s.payment_type.toUpperCase()}</td>
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
                  <td colSpan={9} className="px-4 py-6 text-center text-soft-gray">
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
  type SaleItemDraft = {
    id: string;
    productId: string;
    colour: string;
    size: string;
    quantity: string;
    actualPrice: string;
    paymentType: "cash" | "mpesa";
  };

  const sellable = useMemo(() => products.filter((p) => p.variants.length > 0), [products]);

  const createDraft = (productId = sellable[0]?.id ?? ""): SaleItemDraft => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId,
    colour: "",
    size: "",
    quantity: "1",
    actualPrice: "",
    paymentType: "cash",
  });

  const [saleItems, setSaleItems] = useState<SaleItemDraft[]>(() =>
    sellable.length > 0 ? [createDraft(sellable[0].id)] : [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sellable.length === 0) {
      setSaleItems([]);
      return;
    }

    setSaleItems((current) => {
      if (current.length === 0) return [createDraft(sellable[0].id)];

      return current.map((item) => {
        const validProduct = sellable.some((product) => product.id === item.productId);
        if (!validProduct) {
          return { ...createDraft(sellable[0].id), id: item.id };
        }
        return item;
      });
    });
  }, [sellable]);

  function getVariantForItem(item: SaleItemDraft) {
    const product = sellable.find((candidate) => candidate.id === item.productId) ?? null;
    if (!product) return null;

    const colours = Array.from(new Set(product.variants.map((variant) => variant.colour)));
    const resolvedColour = item.colour || colours[0] || "";
    const sizesForColour = product.variants.filter((variant) => variant.colour === resolvedColour);
    const resolvedSize = item.size || sizesForColour[0]?.size || "";

    return (
      product.variants.find(
        (variant) => variant.colour === resolvedColour && variant.size === resolvedSize,
      ) ?? null
    );
  }

  function updateItem(itemId: string, patch: Partial<SaleItemDraft>) {
    setSaleItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setSaleItems((current) => [...current, createDraft(sellable[0]?.id ?? "")]);
  }

  function removeItem(itemId: string) {
    setSaleItems((current) => {
      if (current.length === 1) {
        return [createDraft(sellable[0]?.id ?? "")];
      }
      return current.filter((item) => item.id !== itemId);
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const payloads = saleItems.map((item) => {
      const product = sellable.find((candidate) => candidate.id === item.productId) ?? null;
      const variant = getVariantForItem(item);

      if (!product || !variant) {
        throw new Error("Select a valid product and variant for every item.");
      }

      const quantity = Number(item.quantity);
      if (!Number.isFinite(quantity) || quantity < 1 || quantity > variant.stock_quantity) {
        throw new Error(`"${product.name}" has insufficient stock or invalid quantity.`);
      }

      return {
        product_variant_id: variant.id,
        quantity,
        actual_price_paid: item.actualPrice ? Number(item.actualPrice) : Number(product.listed_price),
        payment_type: item.paymentType,
      };
    });

    if (payloads.length === 0) {
      setError("Add at least one item before recording a sale.");
      return;
    }

    setSubmitting(true);
    try {
      for (const payload of payloads) {
        await apiFetch("/api/sales", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      setSaleItems(sellable.length > 0 ? [createDraft(sellable[0].id)] : []);
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
    <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-soft-gray/20 bg-charcoal p-4 md:p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {saleItems.map((item, index) => {
          const product = sellable.find((candidate) => candidate.id === item.productId) ?? sellable[0];
          const colours = product ? Array.from(new Set(product.variants.map((variant) => variant.colour))) : [];
          const mappedSizes =
            product && (item.colour || colours[0])
              ? product.variants.filter((variant) => variant.colour === (item.colour || colours[0]))
              : [];
          const variant = getVariantForItem(item);

          return (
            <div key={item.id} className="rounded-md border border-soft-gray/20 bg-midnight p-3 md:col-span-2 xl:col-span-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-ivory">Item {index + 1}</h3>
                {saleItems.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-soft-gray hover:text-error"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
                <div className="xl:col-span-2">
                  <label className="block text-sm text-soft-gray">Product</label>
                  <select
                    value={item.productId}
                    onChange={(e) =>
                      updateItem(item.id, {
                        productId: e.target.value,
                        colour: "",
                        size: "",
                      })
                    }
                    className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-3 py-2 text-ivory outline-none focus:border-gold"
                  >
                    {sellable.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-soft-gray">Colour</label>
                  <select
                    value={item.colour || (colours[0] ?? "")}
                    onChange={(e) => updateItem(item.id, { colour: e.target.value, size: "" })}
                    className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-3 py-2 text-ivory outline-none focus:border-gold"
                  >
                    {colours.map((colour) => (
                      <option key={colour} value={colour}>
                        {colour || "(no colour)"}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-soft-gray">Size</label>
                  <select
                    value={item.size || (mappedSizes[0]?.size ?? "")}
                    onChange={(e) => updateItem(item.id, { size: e.target.value })}
                    className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-3 py-2 text-ivory outline-none focus:border-gold"
                  >
                    {mappedSizes.map((variantOption) => (
                      <option key={variantOption.id} value={variantOption.size}>
                        {variantOption.size || "(no size)"} · {variantOption.stock_quantity} in stock
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-soft-gray">Qty</label>
                  <input
                    type="number"
                    min="1"
                    max={variant?.stock_quantity ?? undefined}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, { quantity: e.target.value })}
                    className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-3 py-2 text-ivory outline-none focus:border-gold"
                  />
                </div>

                <div>
                  <label className="block text-sm text-soft-gray">Payment</label>
                  <select
                    value={item.paymentType}
                    onChange={(e) =>
                      updateItem(item.id, {
                        paymentType: e.target.value as "cash" | "mpesa",
                      })
                    }
                    className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-3 py-2 text-ivory outline-none focus:border-gold"
                  >
                    <option value="cash">Cash</option>
                    <option value="mpesa">M-Pesa</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-soft-gray">Paid</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.actualPrice}
                    onChange={(e) => updateItem(item.id, { actualPrice: e.target.value })}
                    placeholder={product ? String(product.listed_price) : "0"}
                    className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-3 py-2 text-ivory outline-none focus:border-gold"
                  />
                </div>
              </div>

              {variant && variant.stock_quantity === 0 && (
                <p className="mt-2 text-sm text-error">This variant is out of stock.</p>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-4 text-sm text-error">{error}</p>}

      <div className="mt-4 flex flex-col gap-3 border-t border-soft-gray/20 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={addItem}
          className="rounded-md border border-soft-gray/30 px-3 py-2 text-sm font-medium text-ivory hover:bg-charcoal/80"
        >
          + Add item
        </button>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <span className="text-sm text-soft-gray">
            {saleItems.length} item{saleItems.length === 1 ? "" : "s"}
          </span>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={
              submitting ||
              saleItems.length === 0 ||
              saleItems.some((item) => {
                const variant = getVariantForItem(item);
                return !variant || variant.stock_quantity <= 0 || Number(item.quantity) < 1;
              })
            }
          >
            {submitting ? "Recording..." : "Record Sale"}
          </Button>
        </div>
      </div>
    </form>
  );
}