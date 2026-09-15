"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import type { Product, ReceivingItem, ReceivingSession } from "../../types";

// useSearchParams() requires a Suspense boundary in the App Router -
// without this wrapper `npm run build` fails outright.
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-soft-gray">Loading...</p>
        </main>
      }
    >
      <ReceivingPageContent />
    </Suspense>
  );
}

function ReceivingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";

  const [sessions, setSessions] = useState<ReceivingSession[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<ReceivingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const [sessionsData, productsData] = await Promise.all([
        apiFetch<ReceivingSession[]>("/api/stock/sessions"),
        apiFetch<Product[]>("/api/products"),
      ]);
      setSessions(sessionsData);
      setProducts(productsData);

      // A notification link (?session=<id>) always wins; otherwise
      // keep whatever was already selected, or fall back to the most
      // recent session.
      const linked = searchParams.get("session");
      if (linked && sessionsData.some((s) => s.id === linked)) {
        setSelectedSessionId(linked);
      } else if (sessionsData.length > 0) {
        setSelectedSessionId((prev) => prev ?? sessionsData[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load receiving sessions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  async function loadItems(sessionId: string) {
    try {
      const data = await apiFetch<ReceivingItem[]>(`/api/stock/sessions/${sessionId}/items`);
      setItems(data);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load items");
    }
  }

  useEffect(() => {
    if (selectedSessionId) {
      loadItems(selectedSessionId);
    } else {
      setItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSessionId]);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;

  function productName(productId: string): string {
    return products.find((p) => p.id === productId)?.name ?? "\u2014";
  }

  function updateSessionInPlace(updated: ReceivingSession) {
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function handleOpenSession() {
    setActionError(null);
    try {
      const session = await apiFetch<ReceivingSession>("/api/stock/sessions", { method: "POST" });
      setSessions((prev) => [session, ...prev]);
      setSelectedSessionId(session.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to open session");
    }
  }

  async function handleComplete() {
    if (!selectedSessionId) return;
    setActionError(null);
    try {
      const updated = await apiFetch<ReceivingSession>(
        `/api/stock/sessions/${selectedSessionId}/complete`,
        { method: "POST" }
      );
      updateSessionInPlace(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to complete session");
    }
  }

  async function handleClose() {
    if (!selectedSessionId) return;
    setActionError(null);
    try {
      const updated = await apiFetch<ReceivingSession>(
        `/api/stock/sessions/${selectedSessionId}/close`,
        { method: "POST" }
      );
      updateSessionInPlace(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to close session");
    }
  }

  async function handleApprove() {
    if (!selectedSessionId) return;
    setActionError(null);
    try {
      const updated = await apiFetch<ReceivingSession>(
        `/api/stock/sessions/${selectedSessionId}/approve`,
        { method: "POST" }
      );
      updateSessionInPlace(updated);
      loadItems(selectedSessionId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve session");
    }
  }

  async function handleReject(reason: string) {
    if (!selectedSessionId) return;
    setActionError(null);
    try {
      const updated = await apiFetch<ReceivingSession>(
        `/api/stock/sessions/${selectedSessionId}/reject`,
        { method: "POST", body: JSON.stringify({ reason: reason || null }) }
      );
      updateSessionInPlace(updated);
      loadItems(selectedSessionId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject session");
    }
  }

  async function handleReopen(reason: string) {
    if (!selectedSessionId) return;
    setActionError(null);
    try {
      const updated = await apiFetch<ReceivingSession>(
        `/api/stock/sessions/${selectedSessionId}/reopen`,
        { method: "POST", body: JSON.stringify({ reason }) }
      );
      updateSessionInPlace(updated);
      loadItems(selectedSessionId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reopen session");
    }
  }

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
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ivory">Stock Receiving</h1>
          {isAdmin && <Button onClick={handleOpenSession}>Open New Session</Button>}
        </div>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}
        {actionError && <p className="mt-4 text-sm text-error">{actionError}</p>}

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <h2 className="text-sm font-medium text-soft-gray">Sessions</h2>
            <ul className="mt-2 space-y-1">
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSelectedSessionId(s.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                      s.id === selectedSessionId
                        ? "border-gold text-gold"
                        : "border-soft-gray/20 text-soft-gray hover:text-ivory"
                    }`}
                  >
                    <div>{new Date(s.opened_at).toLocaleString()}</div>
                    <StatusBadge status={s.status} />
                  </button>
                </li>
              ))}
              {sessions.length === 0 && (
                <li className="text-sm text-soft-gray">
                  No sessions yet.{" "}
                  {isAdmin
                    ? "Open one above."
                    : "Ask an Admin to open one before entering received stock."}
                </li>
              )}
            </ul>
          </div>

          <div className="md:col-span-2">
            {selectedSession ? (
              <SessionPanel
                session={selectedSession}
                items={items}
                isAdmin={isAdmin}
                products={products}
                productName={productName}
                onComplete={handleComplete}
                onClose={handleClose}
                onApprove={handleApprove}
                onReject={handleReject}
                onReopen={handleReopen}
                onItemAdded={(item) => setItems((prev) => [...prev, item])}
                onItemCorrected={(updated) =>
                  setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                }
              />
            ) : (
              <p className="text-soft-gray">Select a session to view its items.</p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function SessionPanel({
  session,
  items,
  isAdmin,
  products,
  productName,
  onComplete,
  onClose,
  onApprove,
  onReject,
  onReopen,
  onItemAdded,
  onItemCorrected,
}: {
  session: ReceivingSession;
  items: ReceivingItem[];
  isAdmin: boolean;
  products: Product[];
  productName: (id: string) => string;
  onComplete: () => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onReopen: (reason: string) => void;
  onItemAdded: (item: ReceivingItem) => void;
  onItemCorrected: (item: ReceivingItem) => void;
}) {
  const [reasonMode, setReasonMode] = useState<"reject" | "reopen" | null>(null);
  const [reason, setReason] = useState("");

  const canCorrect = isAdmin && session.status === "closed";
  const canReopen =
    isAdmin && (session.status === "staff_completed" || session.status === "closed" || session.status === "rejected");

  function submitReason() {
    if (reasonMode === "reject") {
      onReject(reason);
    } else if (reasonMode === "reopen") {
      onReopen(reason);
    }
    setReasonMode(null);
    setReason("");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-soft-gray">
          Session items <StatusBadge status={session.status} />
        </h2>

        <div className="flex flex-wrap gap-2">
          {!isAdmin && session.status === "open" && items.length > 0 && (
            <Button onClick={onComplete}>Complete Receiving</Button>
          )}
          {isAdmin && session.status === "staff_completed" && (
            <Button onClick={onClose}>Close Session</Button>
          )}
          {isAdmin && session.status === "closed" && (
            <>
              <Button onClick={onApprove}>Approve</Button>
              <Button variant="danger" onClick={() => setReasonMode("reject")}>
                Reject
              </Button>
            </>
          )}
          {canReopen && (
            <Button variant="secondary" onClick={() => setReasonMode("reopen")}>
              Reopen
            </Button>
          )}
        </div>
      </div>

      {session.rejection_reason && (
        <p className="mt-2 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
          Rejection reason: {session.rejection_reason}
        </p>
      )}
      {session.reopen_reason && (
        <p className="mt-2 rounded-md border border-soft-gray/20 bg-midnight px-3 py-2 text-sm text-soft-gray">
          Last reopened: {session.reopen_reason}
        </p>
      )}

      {reasonMode && (
        <div className="mt-3 rounded-lg border border-soft-gray/20 bg-charcoal p-4">
          <label className="block text-xs text-soft-gray">
            {reasonMode === "reject" ? "Reason for rejection (optional)" : "Reason for reopening"}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required={reasonMode === "reopen"}
            rows={2}
            className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-sm text-ivory outline-none focus:border-gold"
          />
          <div className="mt-2 flex gap-2">
            <Button
              variant={reasonMode === "reject" ? "danger" : "secondary"}
              onClick={submitReason}
              disabled={reasonMode === "reopen" && reason.trim().length === 0}
            >
              Confirm {reasonMode === "reject" ? "Rejection" : "Reopen"}
            </Button>
            <Button variant="secondary" onClick={() => setReasonMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <table className="mt-3 w-full text-left text-sm">
        <thead className="text-soft-gray">
          <tr>
            <th className="py-2 font-medium">Product</th>
            <th className="py-2 font-medium">Colour</th>
            <th className="py-2 font-medium">Size</th>
            <th className="py-2 font-medium">Submitted</th>
            <th className="py-2 font-medium">Approved</th>
            <th className="py-2 font-medium">Status</th>
            {canCorrect && <th className="py-2 font-medium">Correct</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              productName={productName(item.product_id)}
              canCorrect={canCorrect}
              onCorrected={onItemCorrected}
            />
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="py-4 text-soft-gray">
                No items yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {session.status === "open" && (
        <AddItemForm products={products} sessionId={session.id} onAdded={onItemAdded} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    open: "bg-royal-purple/30 text-ivory",
    staff_completed: "bg-gold/20 text-gold",
    closed: "bg-soft-gray/20 text-ivory",
    approved: "bg-success/20 text-success",
    rejected: "bg-error/20 text-error",
    pending: "bg-gold/20 text-gold",
  };
  const labels: Record<string, string> = {
    staff_completed: "staff completed",
  };
  return (
    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${colors[status] ?? ""}`}>
      {labels[status] ?? status}
    </span>
  );
}

function ItemRow({
  item,
  productName,
  canCorrect,
  onCorrected,
}: {
  item: ReceivingItem;
  productName: string;
  canCorrect: boolean;
  onCorrected: (item: ReceivingItem) => void;
}) {
  const [qty, setQty] = useState(String(item.quantity_approved ?? item.quantity_submitted));
  const [price, setPrice] = useState(String(item.price_approved ?? item.price_submitted));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await apiFetch<ReceivingItem>(`/api/stock/items/${item.id}/correct`, {
        method: "PATCH",
        body: JSON.stringify({
          quantity_approved: Number(qty),
          price_approved: price,
        }),
      });
      onCorrected(updated);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-t border-soft-gray/10">
      <td className="py-2 text-ivory">{productName}</td>
      <td className="py-2 text-soft-gray">{item.colour || "\u2014"}</td>
      <td className="py-2 text-soft-gray">{item.size || "\u2014"}</td>
      <td className="py-2 text-soft-gray">
        {item.quantity_submitted} @ KSh {Number(item.price_submitted).toLocaleString()}
      </td>
      <td className="py-2 text-ivory">
        {item.quantity_approved ?? "\u2014"}
        {item.price_approved ? ` @ KSh ${Number(item.price_approved).toLocaleString()}` : ""}
      </td>
      <td className="py-2">
        <StatusBadge status={item.status} />
      </td>
      {canCorrect && (
        <td className="py-2">
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-16 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-20 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
            />
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              Save
            </Button>
          </div>
        </td>
      )}
    </tr>
  );
}

function AddItemForm({
  products,
  sessionId,
  onAdded,
}: {
  products: Product[];
  sessionId: string;
  onAdded: (item: ReceivingItem) => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [colour, setColour] = useState("");
  const [size, setSize] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const knownColours = Array.from(
    new Set((selectedProduct?.variants ?? []).map((v) => v.colour).filter(Boolean))
  );
  const knownSizes = Array.from(
    new Set((selectedProduct?.variants ?? []).map((v) => v.size).filter(Boolean))
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const item = await apiFetch<ReceivingItem>(`/api/stock/sessions/${sessionId}/items`, {
        method: "POST",
        body: JSON.stringify({
          product_id: productId,
          colour: colour.trim() || null,
          size: size.trim() || null,
          quantity_submitted: Number(quantity),
          price_submitted: price,
        }),
      });
      onAdded(item);
      setQuantity("1");
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSubmitting(false);
    }
  }

  if (products.length === 0) {
    return <p className="mt-4 text-sm text-soft-gray">No products to receive yet.</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-soft-gray/20 bg-charcoal p-4"
    >
      <div>
        <label className="block text-xs text-soft-gray">Product</label>
        <select
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
          className="mt-1 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs text-soft-gray">
          Colour <span className="text-soft-gray/60">(optional)</span>
        </label>
        <input
          list="colour-suggestions"
          value={colour}
          onChange={(e) => setColour(e.target.value)}
          placeholder="e.g. Red"
          className="mt-1 w-28 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
        />
        <datalist id="colour-suggestions">
          {knownColours.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs text-soft-gray">
          Size <span className="text-soft-gray/60">(optional)</span>
        </label>
        <input
          list="size-suggestions"
          value={size}
          onChange={(e) => setSize(e.target.value)}
          placeholder="e.g. 40"
          className="mt-1 w-20 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
        />
        <datalist id="size-suggestions">
          {knownSizes.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs text-soft-gray">Quantity</label>
        <input
          type="number"
          min="1"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="mt-1 w-20 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
        />
      </div>
      <div>
        <label className="block text-xs text-soft-gray">Price (KSh)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          required
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="mt-1 w-24 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
        />
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
      <Button type="submit" disabled={submitting}>
        {submitting ? "Adding..." : "Add Item"}
      </Button>
    </form>
  );
}