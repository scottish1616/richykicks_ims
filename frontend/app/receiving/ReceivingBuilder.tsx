"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import type { Category, Product, ReceivingSession } from "../../types";
import Button from "../../components/Button";

type ReceivingLine = {
  id: string;
  product_id: string;
  colour: string;
  size: string;
  quantity: number;
  price: string;
};

type ReceivingBuilderProps = {
  products: Product[];
  categories: Category[];
  mode: "direct" | "staff";
  sessionId?: string;
  onDirectSubmitted?: () => void;
  onStaffSubmitted?: (session: ReceivingSession) => void;
};

const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20";

export default function ReceivingBuilder({
  products,
  categories,
  mode,
  sessionId,
  onDirectSubmitted,
  onStaffSubmitted,
}: ReceivingBuilderProps) {
  const [productId, setProductId] = useState("");
  const [colour, setColour] = useState("");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [lines, setLines] = useState<ReceivingLine[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const product = products.find((candidate) => candidate.id === productId);
  const category = categories.find((candidate) => candidate.id === product?.category_id);
  const colours = useMemo(
    () => Array.from(new Set((product?.variants ?? []).map((variant) => variant.colour).filter(Boolean))),
    [product]
  );
  const sizes = useMemo(() => {
    const categorySizes = category?.sizes ?? [];
    const knownSizes = (product?.variants ?? []).map((variant) => variant.size).filter(Boolean);
    return Array.from(new Set([...categorySizes, ...knownSizes]));
  }, [category, product]);
  const isSizeBased = sizes.length > 0;
  const totalQuantity = lines.reduce((total, line) => total + Math.max(0, line.quantity), 0);

  function resetDraft() {
    setProductId("");
    setColour("");
    setSizeQuantities({});
    setQuantity("");
    setPrice("");
  }

  function chooseProduct(nextProductId: string) {
    const nextProduct = products.find((candidate) => candidate.id === nextProductId);
    setProductId(nextProductId);
    setColour("");
    setSizeQuantities({});
    setQuantity("");
    setPrice(nextProduct?.listed_price ?? "");
    setError("");
    setNotice("");
  }

  function currentStock(size: string): number {
    return (
      product?.variants.find((variant) => variant.colour === colour && variant.size === size)
        ?.stock_quantity ?? 0
    );
  }

  function addToList() {
    setError("");
    setNotice("");
    if (!product) {
      setError("Select a product before continuing.");
      return;
    }
    if (colours.length > 0 && !colour) {
      setError("Select a colour before continuing.");
      return;
    }
    if (price.trim() === "" || !Number.isFinite(Number(price)) || Number(price) < 0) {
      setError("Enter a valid unit price.");
      return;
    }

    const quantities = isSizeBased
      ? Object.entries(sizeQuantities)
          .map(([size, value]) => [size, Number(value)] as const)
          .filter(([, value]) => Number.isInteger(value) && value > 0)
      : [["", Number(quantity)] as const].filter(([, value]) => Number.isInteger(value) && value > 0);

    if (quantities.length === 0) {
      setError("Enter at least one quantity before continuing.");
      return;
    }

    setLines((previous) => {
      const next = previous.map((line) =>
        line.product_id === product.id ? { ...line, price } : line
      );
      for (const [size, received] of quantities) {
        const existingIndex = next.findIndex(
          (line) =>
            line.product_id === product.id && line.colour === colour && line.size === size
        );
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + received,
            price,
          };
        } else {
          next.push({
            id: `${product.id}:${colour}:${size}:${crypto.randomUUID()}`,
            product_id: product.id,
            colour,
            size,
            quantity: received,
            price,
          });
        }
      }
      return next;
    });
    setSizeQuantities({});
    setQuantity("");
    setNotice(`${quantities.length} variant${quantities.length === 1 ? "" : "s"} added to the receive list.`);
  }

  function updateLineQuantity(id: string, value: string) {
    const nextQuantity = value === "" ? 0 : Number(value);
    setLines((previous) =>
      previous.map((line) => (line.id === id ? { ...line, quantity: nextQuantity } : line))
    );
  }

  async function confirmReceiving() {
    setError("");
    setNotice("");
    const submittedLines = lines.filter(
      (line) => Number.isInteger(line.quantity) && line.quantity > 0
    );
    if (submittedLines.length === 0) {
      setError("Enter at least one quantity before continuing.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "direct") {
        await apiFetch("/api/stock/direct-receive/batch", {
          method: "POST",
          body: JSON.stringify({
            items: submittedLines.map((line) => ({
              product_id: line.product_id,
              colour: line.colour || null,
              size: line.size || null,
              quantity: line.quantity,
              price: line.price,
            })),
          }),
        });
        onDirectSubmitted?.();
        setNotice("Receiving confirmed. Inventory has been updated.");
      } else {
        if (!sessionId) {
          setError("Staff receiving is not open yet. Ask an admin to start it.");
          return;
        }
        const updatedSession = await apiFetch<ReceivingSession>(
          `/api/stock/sessions/${sessionId}/items/batch`,
          {
            method: "POST",
            body: JSON.stringify({
              items: submittedLines.map((line) => ({
                product_id: line.product_id,
                colour: line.colour || null,
                size: line.size || null,
                quantity_submitted: line.quantity,
                price_submitted: line.price,
              })),
            }),
          }
        );
        onStaffSubmitted?.(updatedSession);
        setNotice("Submission sent to Admin for review. Stock has not been updated yet.");
      }
      setLines([]);
      resetDraft();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit received stock.");
    } finally {
      setSubmitting(false);
    }
  }

  if (products.length === 0) {
    return <p className="mt-5 text-sm text-slate-400">No active products are available to receive.</p>;
  }

  return (
    <section className="glass-panel rounded-2xl border-amber-500/25 p-4 sm:p-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-400">
          {mode === "direct" ? "Admin · Immediate inventory update" : "Staff · Admin approval required"}
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-white">Receive Stock</h2>
        <p className="mt-1 text-sm text-slate-400">
          Select a product, enter the quantities received, then review before submitting.
        </p>
      </div>

      <div className="grid gap-5">
        <div>
          <label htmlFor={`receive-product-${mode}`} className="block text-sm font-medium text-slate-200">
            Product
          </label>
          <select
            id={`receive-product-${mode}`}
            value={productId}
            onChange={(event) => chooseProduct(event.target.value)}
            className={fieldClass}
          >
            <option value="">Choose a product</option>
            {products.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {product && (
          <div className="rounded-xl border border-slate-700 bg-slate-950/70 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Current stock: {product.total_stock} units
                  {category ? ` · ${category.name}` : ""}
                </p>
              </div>
              <div className="w-full sm:w-44">
                <label className="block text-xs font-medium text-slate-400">Unit price (KSh)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>

            {colours.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium text-slate-200">Colour</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Choose colour">
                  {colours.map((option) => {
                    const selected = option === colour;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setColour(option)}
                        className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-amber-400/70 ${
                          selected
                            ? "border-amber-400 bg-blue-900 text-white shadow-sm shadow-amber-500/15"
                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
                        }`}
                      >
                        <span className="mr-2" aria-hidden="true">{selected ? "●" : "○"}</span>
                        {option}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {isSizeBased ? (
              <div className="mt-5">
                <div className="mb-2 grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.2fr)] gap-2 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:gap-3 sm:text-xs">
                  <span>Size</span>
                  <span>Current stock</span>
                  <span>Quantity received</span>
                </div>
                <div className="space-y-2">
                  {sizes.map((size) => (
                    <div
                      key={size}
                      className="grid grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-2 sm:gap-3 sm:px-3"
                    >
                      <span className="font-semibold text-white">{size}</span>
                      <span className="text-sm text-slate-400">{currentStock(size)}</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        inputMode="numeric"
                        aria-label={`Quantity received for size ${size}`}
                        placeholder="0"
                        value={sizeQuantities[size] ?? ""}
                        onChange={(event) =>
                          setSizeQuantities((previous) => ({ ...previous, [size]: event.target.value }))
                        }
                        disabled={colours.length > 0 && !colour}
                        className="min-w-0 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-3 text-base text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:px-3"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-5 max-w-sm">
                <label className="block text-sm font-medium text-slate-200">Quantity received</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  placeholder="Enter quantity"
                  disabled={colours.length > 0 && !colour}
                  className={`${fieldClass} text-base disabled:cursor-not-allowed disabled:opacity-50`}
                />
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={addToList} className="min-h-11 !bg-amber-500 !text-slate-950 hover:!bg-amber-400">
                Add to Receive List
              </Button>
              {lines.length > 0 && (
                <Button type="button" variant="secondary" onClick={resetDraft} className="min-h-11">
                  + Add Another Product
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {lines.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-700 bg-slate-950/70 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-semibold text-white">Received Items</h3>
              <p className="text-sm text-slate-400">Check quantities before confirming.</p>
            </div>
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-300">
              Total quantity: {totalQuantity}
            </span>
          </div>
          <ul className="mt-4 divide-y divide-slate-800">
            {lines.map((line) => {
              const lineProduct = products.find((item) => item.id === line.product_id);
              return (
                <li key={line.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-white">{lineProduct?.name ?? "Product"}</p>
                    <p className="mt-0.5 text-sm text-slate-400">
                      {[line.colour, line.size].filter(Boolean).join(" · ") || "No colour or size variant"}
                      {` · KSh ${Number(line.price).toLocaleString()} each`}
                    </p>
                  </div>
                  <label className="w-28 text-xs text-slate-400">
                    Qty
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={line.quantity || ""}
                      onChange={(event) => updateLineQuantity(line.id, event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-base text-white"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setLines((previous) => previous.filter((entry) => entry.id !== line.id))}
                    className="rounded-lg px-3 py-2 text-sm font-medium text-rose-300 hover:bg-rose-500/10"
                    aria-label={`Remove ${lineProduct?.name ?? "product"} ${line.colour} ${line.size}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setLines([])} disabled={submitting}>
              Clear list
            </Button>
            <Button
              type="button"
              onClick={confirmReceiving}
              disabled={submitting}
              className="min-h-12 !bg-amber-500 px-6 text-base !text-slate-950 hover:!bg-amber-400"
            >
              {submitting
                ? "Submitting..."
                : mode === "direct"
                  ? "Confirm Receiving"
                  : "Submit to Admin"}
            </Button>
          </div>
        </div>
      )}

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            error ? "border-rose-500/30 bg-rose-500/10 text-rose-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          {error || notice}
        </p>
      )}
    </section>
  );
}
