"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import type { Product, Category, ProductVariant } from "../../types";

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [productsData, categoriesData] = await Promise.all([
        apiFetch<Product[]>(`/api/products${isAdmin ? "?include_inactive=true" : ""}`),
        apiFetch<Category[]>("/api/products/categories"),
      ]);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin]);

  function categoryName(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? "\u2014";
  }

  const visibleProducts = products.filter((product) => showInactive || product.is_active);

  if (authLoading || loading) {
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-ivory">Product Management</h1>
            {!isAdmin && <p className="mt-1 text-sm text-soft-gray">View products and stock.</p>}
          </div>
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setShowInactive((value) => !value)}>
                {showInactive ? "Hide Inactive" : "Show Inactive"}
              </Button>
              <Button onClick={() => {
                setEditingProduct(null);
                setShowForm((value) => !value);
              }}>
                {showForm ? "Cancel" : "Add Product"}
              </Button>
            </div>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}

        {isAdmin && (showForm || editingProduct) && (
          <ProductForm
            key={editingProduct?.id ?? "new-product"}
            categories={categories}
            product={editingProduct}
            onCreated={() => {
              setShowForm(false);
              setEditingProduct(null);
              void loadData();
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingProduct(null);
            }}
          />
        )}

        <p className="mt-6 text-xs text-soft-gray">
          Click a product to see its colours/sizes. New variants appear
          automatically once stock for them is received and approved.
        </p>

        <div className="mt-2 overflow-hidden rounded-lg border border-soft-gray/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-charcoal text-soft-gray">
              <tr>
                <th className="px-4 py-3 font-medium"></th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Price</th>
                <th className="px-4 py-3 font-medium">Total Stock</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {isAdmin && <th className="px-4 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visibleProducts.map((p) => {
                const expanded = expandedId === p.id;
                return (
                  <ProductRowGroup
                    key={p.id}
                    product={p}
                    categoryName={categoryName(p.category_id)}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : p.id)}
                    isAdmin={isAdmin}
                    onEdit={() => {
                      setShowForm(false);
                      setEditingProduct(p);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onStatusChange={async () => {
                      if (p.is_active && !window.confirm(`Deactivate ${p.name}? It will remain in history and can be reactivated later.`)) {
                        return;
                      }
                      try {
                        await apiFetch<Product>(
                          `/api/products/${p.id}/${p.is_active ? "deactivate" : "reactivate"}`,
                          { method: "POST" }
                        );
                        await loadData();
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Failed to update product status");
                      }
                    }}
                    onStockChanged={() => void loadData()}
                  />
                );
              })}
              {visibleProducts.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="px-4 py-6 text-center text-soft-gray">
                    {showInactive ? "No products found." : "No active products found."}
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

function ProductRowGroup({
  product,
  categoryName,
  expanded,
  onToggle,
  isAdmin,
  onEdit,
  onStatusChange,
  onStockChanged,
}: {
  product: Product;
  categoryName: string;
  expanded: boolean;
  onToggle: () => void;
  isAdmin: boolean;
  onEdit: () => void;
  onStatusChange: () => void;
  onStockChanged: () => void;
}) {
  const [adjustingVariant, setAdjustingVariant] = useState<ProductVariant | null>(null);
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer border-t border-soft-gray/10 hover:bg-charcoal/60"
      >
        <td className="px-4 py-3 text-soft-gray">{expanded ? "\u25be" : "\u25b8"}</td>
        <td className="px-4 py-3 text-ivory">{product.name}</td>
        <td className="px-4 py-3 text-soft-gray">{categoryName}</td>
        <td className="px-4 py-3 text-ivory">
          KSh {Number(product.listed_price).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-ivory">{product.total_stock}</td>
        <td className="px-4 py-3">
          <span
            className={
              !product.is_active
                ? "rounded-full bg-soft-gray/20 px-2 py-1 text-xs text-soft-gray"
                : product.stock_status === "In Stock"
                ? "rounded-full bg-success/20 px-2 py-1 text-xs text-success"
                : "rounded-full bg-error/20 px-2 py-1 text-xs text-error"
            }
          >
            {!product.is_active ? "Inactive" : product.stock_status}
          </span>
        </td>
        {isAdmin && (
          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onEdit}>
                Edit
              </Button>
              <Button
                variant={product.is_active ? "danger" : "primary"}
                className="px-3 py-1.5 text-xs"
                onClick={onStatusChange}
              >
                {product.is_active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr className="border-t border-soft-gray/10 bg-midnight">
          <td colSpan={isAdmin ? 7 : 6} className="px-4 py-3">
            {product.variants.length === 0 ? (
              <p className="text-xs text-soft-gray">
                No stock received yet for this product.
              </p>
            ) : (
              <table className="w-full max-w-2xl text-left text-xs">
                <thead className="text-soft-gray">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Colour</th>
                    <th className="py-1 pr-4 font-medium">Size</th>
                    <th className="py-1 font-medium">Stock</th>
                    {isAdmin && <th className="py-1 font-medium">Adjustment</th>}
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr key={v.id} className="border-t border-soft-gray/10">
                      <td className="py-1 pr-4 text-ivory">{v.colour || "\u2014"}</td>
                      <td className="py-1 pr-4 text-ivory">{v.size || "\u2014"}</td>
                      <td className="py-1 text-ivory">{v.stock_quantity}</td>
                      {isAdmin && (
                        <td className="py-1 pl-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => setAdjustingVariant(v)}
                          >
                            Adjust Stock
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {isAdmin && adjustingVariant && (
              <StockAdjustmentForm
                product={product}
                variant={adjustingVariant}
                onCancel={() => setAdjustingVariant(null)}
                onAdjusted={() => {
                  setAdjustingVariant(null);
                  onStockChanged();
                }}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ProductForm({
  categories,
  product,
  onCreated,
  onCancel,
}: {
  categories: Category[];
  product: Product | null;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? "");
  const [price, setPrice] = useState(product?.listed_price ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch(product ? `/api/products/${product.id}` : "/api/products", {
        method: product ? "PATCH" : "POST",
        body: JSON.stringify({
          name,
          category_id: categoryId,
          listed_price: price,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${product ? "update" : "create"} product`);
    } finally {
      setSubmitting(false);
    }
  }

  if (categories.length === 0) {
    return (
      <p className="mt-4 text-sm text-error">
        No categories found - run{" "}
        <code className="rounded bg-midnight px-1">python scripts/seed_categories.py</code>{" "}
        on the backend first.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-soft-gray/20 bg-charcoal p-6 sm:grid-cols-3"
    >
      <div>
        <label className="block text-sm text-soft-gray">Name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        />
      </div>
      <div>
        <label className="block text-sm text-soft-gray">Category</label>
        <select
          required
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm text-soft-gray">Listed Price (KSh)</label>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory outline-none focus:border-gold"
        />
      </div>

      <p className="text-xs text-soft-gray sm:col-span-3">
        Stock adjustments are separate from product details and recorded in the audit log.
      </p>

      {error && <p className="text-sm text-error sm:col-span-3">{error}</p>}

      <div className="sm:col-span-3">
        <div className="flex gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : product ? "Save Changes" : "Save Product"}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        </div>
      </div>
    </form>
  );
}

function StockAdjustmentForm({
  product,
  variant,
  onCancel,
  onAdjusted,
}: {
  product: Product;
  variant: ProductVariant;
  onCancel: () => void;
  onAdjusted: () => void;
}) {
  const [adjustment, setAdjustment] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const resultingStock = variant.stock_quantity + Number(adjustment || 0);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const amount = Number(adjustment);
    if (!Number.isInteger(amount) || amount === 0) {
      setError("Enter a non-zero whole-number adjustment.");
      return;
    }
    if (variant.stock_quantity + amount < 0) {
      setError("Stock cannot be adjusted below zero.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch<ProductVariant>(`/api/products/variants/${variant.id}/adjust-stock`, {
        method: "POST",
        body: JSON.stringify({ adjustment: amount, reason }),
      });
      onAdjusted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 max-w-2xl rounded-lg border border-gold/30 bg-charcoal p-4">
      <h3 className="font-medium text-ivory">
        Adjust Stock · {product.name} · {[variant.colour, variant.size].filter(Boolean).join(" / ") || "Standard"}
      </h3>
      <p className="mt-1 text-xs text-soft-gray">
        Current: {variant.stock_quantity} · New stock: {Number.isFinite(resultingStock) ? resultingStock : variant.stock_quantity}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-soft-gray">
          Adjustment (+ add / − remove)
          <input
            type="number"
            step="1"
            required
            value={adjustment}
            onChange={(event) => setAdjustment(event.target.value)}
            placeholder="e.g. 5 or -2"
            className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory"
          />
        </label>
        <label className="text-sm text-soft-gray">
          Reason
          <input
            required
            minLength={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Physical count correction"
            className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-ivory"
          />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Record Adjustment"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </form>
  );
}