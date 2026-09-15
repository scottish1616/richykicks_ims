"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import type { Product, Category } from "../../types";

export default function Page() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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
        apiFetch<Product[]>("/api/products"),
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
  }, [authLoading, user]);

  function categoryName(categoryId: string): string {
    return categories.find((c) => c.id === categoryId)?.name ?? "\u2014";
  }

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ivory">Products</h1>
          {isAdmin && (
            <Button onClick={() => setShowForm((s) => !s)}>
              {showForm ? "Cancel" : "Add Product"}
            </Button>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}

        {isAdmin && showForm && (
          <ProductForm
            categories={categories}
            onCreated={() => {
              setShowForm(false);
              loadData();
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
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const expanded = expandedId === p.id;
                return (
                  <ProductRowGroup
                    key={p.id}
                    product={p}
                    categoryName={categoryName(p.category_id)}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : p.id)}
                  />
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-soft-gray">
                    No products yet.
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
}: {
  product: Product;
  categoryName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
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
              product.stock_status === "In Stock"
                ? "rounded-full bg-success/20 px-2 py-1 text-xs text-success"
                : "rounded-full bg-error/20 px-2 py-1 text-xs text-error"
            }
          >
            {product.stock_status}
          </span>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-soft-gray/10 bg-midnight">
          <td colSpan={6} className="px-4 py-3">
            {product.variants.length === 0 ? (
              <p className="text-xs text-soft-gray">
                No stock received yet for this product.
              </p>
            ) : (
              <table className="w-full max-w-md text-left text-xs">
                <thead className="text-soft-gray">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Colour</th>
                    <th className="py-1 pr-4 font-medium">Size</th>
                    <th className="py-1 font-medium">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {product.variants.map((v) => (
                    <tr key={v.id} className="border-t border-soft-gray/10">
                      <td className="py-1 pr-4 text-ivory">{v.colour || "\u2014"}</td>
                      <td className="py-1 pr-4 text-ivory">{v.size || "\u2014"}</td>
                      <td className="py-1 text-ivory">{v.stock_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ProductForm({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          name,
          category_id: categoryId,
          listed_price: price,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
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
        No stock/size/colour here - add those via Receiving once this
        product is saved.
      </p>

      {error && <p className="text-sm text-error sm:col-span-3">{error}</p>}

      <div className="sm:col-span-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save Product"}
        </Button>
      </div>
    </form>
  );
}