"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import type { Category, Product, ReceivingItem, ReceivingSession } from "../../types";

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
  const [categories, setCategories] = useState<Category[]>([]);
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
      const [sessionsData, productsData, categoriesData] = await Promise.all([
        apiFetch<ReceivingSession[]>("/api/stock/sessions"),
        apiFetch<Product[]>("/api/products"),
        apiFetch<Category[]>("/api/products/categories"),
      ]);
      setSessions(sessionsData);
      setProducts(productsData);
      setCategories(categoriesData);

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

  function categoryFor(product: Product | undefined): Category | undefined {
    if (!product) return undefined;
    return categories.find((c) => c.id === product.category_id);
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

  async function handleCancel() {
    if (!selectedSessionId) return;
    setActionError(null);
    try {
      const updated = await apiFetch<ReceivingSession>(
        `/api/stock/sessions/${selectedSessionId}/cancel`,
        { method: "POST" }
      );
      updateSessionInPlace(updated);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel session");
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
                categories={categories}
                productName={productName}
                categoryFor={categoryFor}
                onComplete={handleComplete}
                onCancel={handleCancel}
                onClose={handleClose}
                onApprove={handleApprove}
                onReject={handleReject}
                onReopen={handleReopen}
                onItemAdded={() => selectedSessionId && loadItems(selectedSessionId)}
                onItemCorrected={(updated) =>
                  setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
                }
              />
            ) : (
              <p className="text-soft-gray">Select a session to view its items.</p>
            )}
          </div>
        </div>

        {isAdmin && (
          <DirectReceivePanel
            products={products}
            categories={categories}
            categoryFor={categoryFor}
          />
        )}
      </main>
    </>
  );
}

function SessionPanel({
  session,
  items,
  isAdmin,
  products,
  categories,
  productName,
  categoryFor,
  onComplete,
  onCancel,
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
  categories: Category[];
  productName: (id: string) => string;
  categoryFor: (product: Product | undefined) => Category | undefined;
  onComplete: () => void;
  onCancel: () => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onReopen: (reason: string) => void;
  onItemAdded: () => void;
  onItemCorrected: (item: ReceivingItem) => void;
}) {
  const [reasonMode, setReasonMode] = useState<"reject" | "reopen" | null>(null);
  const [reason, setReason] = useState("");

  const canCorrect = isAdmin && session.status === "closed";
  const canReopen =
    isAdmin && (session.status === "staff_completed" || session.status === "closed" || session.status === "rejected");
  const canCancel = isAdmin && session.status === "open" && items.length === 0;
  // Either role can complete a session they've been entering items
  // into - the backend already permits both (require_any_role), so
  // Admin must not get stuck unable to complete a session they opened
  // and filled solo, with no Staff involved at all.
  const canComplete = session.status === "open" && items.length > 0;

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
          {canComplete && <Button onClick={onComplete}>Complete Receiving</Button>}
          {canCancel && (
            <Button variant="secondary" onClick={onCancel}>
              Cancel Session
            </Button>
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
        <AddItemForm
          products={products}
          categories={categories}
          categoryFor={categoryFor}
          sessionId={session.id}
          onAdded={onItemAdded}
        />
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
    cancelled: "bg-soft-gray/20 text-soft-gray",
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

/**
 * Shared size-entry UI used by both AddItemForm (per-session receiving)
 * and DirectReceivePanel (session-free admin receipt). When the
 * selected product's category has standard sizes (e.g. Sneakers,
 * 36-46), this renders a checkbox grid with a quantity box per checked
 * size, so several sizes can be entered in one go instead of one
 * free-text row at a time. Categories with no standard sizes (e.g.
 * Mikasa Balls, Socks) fall back to a single free-text size field.
 */
function ColourEntryGrid({
  colours,
  quantities,
  onQuantityChange,
  freeTextColour,
  onFreeTextColourChange,
  pattern,
  onPatternChange,
}: {
  colours: string[];
  quantities: Record<string, string>;
  onQuantityChange: (colour: string, quantity: string) => void;
  freeTextColour: string;
  onFreeTextColourChange: (value: string) => void;
  pattern: string;
  onPatternChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const selectedCount = Object.keys(quantities).length;

  if (colours.length === 0) {
    return (
      <div className="min-w-[180px] flex-1">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-left text-xs text-soft-gray"
        >
          <span>Colour</span>
          <span>{expanded ? "−" : "+"}</span>
        </button>
        {expanded && (
          <div className="mt-2">
            <label className="block text-xs text-soft-gray">
              Colour <span className="text-soft-gray/60">(optional)</span>
            </label>
            <input
              value={freeTextColour}
              onChange={(e) => onFreeTextColourChange(e.target.value)}
              placeholder="e.g. Red"
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-[220px] flex-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md border border-soft-gray/30 bg-midnight px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-soft-gray transition hover:border-gold/40 hover:text-ivory"
      >
        <span>
          Colour {selectedCount > 0 ? `(${selectedCount})` : ""}
        </span>
        <span className="text-sm text-gold">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="mt-2 rounded-md border border-soft-gray/20 bg-charcoal p-2.5">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-soft-gray/80">
            Select all colours in the combo. One quantity applies to the full combination.
          </p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {colours.map((colour) => {
              const checked = colour in quantities;
              return (
                <div
                  key={colour}
                  className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 ${
                    checked ? "border-gold bg-gold/5" : "border-soft-gray/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onQuantityChange(colour, "1");
                      } else {
                        onQuantityChange(colour, "");
                      }
                    }}
                  />
                  <span className="text-sm text-ivory">{colour}</span>
                  {checked && (
                    <input
                      type="number"
                      min="1"
                      value={quantities[colour]}
                      onChange={(e) => onQuantityChange(colour, e.target.value)}
                      className="w-14 rounded-md border border-soft-gray/30 bg-midnight px-1 py-0.5 text-xs text-ivory"
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-soft-gray/80">
                Pattern
              </label>
              <select
                value={pattern}
                onChange={(e) => onPatternChange(e.target.value)}
                className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-sm text-ivory"
              >
                <option value="Solid">Solid</option>
                <option value="Striped">Striped</option>
                <option value="Two-tone">Two-tone</option>
                <option value="Multi-colour">Multi-colour</option>
                <option value="Custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-soft-gray/80">
                Custom combination
              </label>
              <input
                value={freeTextColour}
                onChange={(e) => onFreeTextColourChange(e.target.value)}
                placeholder="e.g. Striped Black / White"
                className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-sm text-ivory"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SizeEntryGrid({
  category,
  quantities,
  onQuantityChange,
  freeTextSize,
  onFreeTextSizeChange,
}: {
  category: Category | undefined;
  quantities: Record<string, string>;
  onQuantityChange: (size: string, quantity: string) => void;
  freeTextSize: string;
  onFreeTextSizeChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const sizes = category?.sizes ?? [];
  const selectedCount = Object.keys(quantities).length;

  if (sizes.length === 0) {
    return (
      <div className="min-w-[180px] flex-1">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-md border border-soft-gray/30 bg-midnight px-3 py-2 text-left text-xs text-soft-gray"
        >
          <span>Size</span>
          <span>{expanded ? "−" : "+"}</span>
        </button>
        {expanded && (
          <div className="mt-2">
            <label className="block text-xs text-soft-gray">
              Size <span className="text-soft-gray/60">(optional)</span>
            </label>
            <input
              value={freeTextSize}
              onChange={(e) => onFreeTextSizeChange(e.target.value)}
              placeholder="e.g. Large"
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-w-[260px] flex-1">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-md border border-soft-gray/30 bg-midnight px-2.5 py-1.5 text-left text-[11px] font-medium uppercase tracking-wide text-soft-gray transition hover:border-gold/40 hover:text-ivory"
      >
        <span>
          Size {selectedCount > 0 ? `(${selectedCount})` : ""}
        </span>
        <span className="text-sm text-gold">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="mt-2 rounded-md border border-soft-gray/20 bg-charcoal p-2.5">
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {sizes.map((size) => {
              const checked = size in quantities;
              return (
                <div
                  key={size}
                  className={`flex items-center gap-1.5 rounded-md border px-1.5 py-1 ${
                    checked ? "border-gold bg-gold/5" : "border-soft-gray/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onQuantityChange(size, "1");
                      } else {
                        onQuantityChange(size, "");
                      }
                    }}
                  />
                  <span className="text-sm text-ivory">{size}</span>
                  {checked && (
                    <input
                      type="number"
                      min="1"
                      value={quantities[size]}
                      onChange={(e) => onQuantityChange(size, e.target.value)}
                      className="w-14 rounded-md border border-soft-gray/30 bg-midnight px-1 py-0.5 text-xs text-ivory"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const STANDARD_COLOURS = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Navy",
  "Green",
  "Yellow",
  "Orange",
  "Purple",
  "Pink",
  "Brown",
  "Grey",
  "Silver",
  "Gold",
  "Beige",
  "Cream",
  "Maroon",
  "Teal",
  "Olive",
  "Tan",
];

function buildColourCombination(selectedColours: string[], pattern: string): string {
  const combined = Array.from(new Set(selectedColours.map((colour) => colour.trim()).filter(Boolean))).join(" / ");
  if (!combined) return "";

  if (pattern && pattern !== "Solid" && pattern !== "Custom") {
    return `${pattern} ${combined}`;
  }

  return combined;
}

function resolveColourEntries(
  quantities: Record<string, string>,
  freeTextColour: string,
  pattern: string
): Array<[string, string]> {
  const selected = Object.entries(quantities).filter(([, quantity]) => Number(quantity) > 0);
  if (selected.length > 0) {
    const colourNames = selected.map(([colour]) => colour.trim()).filter(Boolean);
    const combinedColour = buildColourCombination(colourNames, pattern);
    return combinedColour ? [[combinedColour, selected[0][1]]] : [];
  }

  const customValue = freeTextColour.trim();
  if (!customValue) return [];

  if (pattern && pattern !== "Solid" && pattern !== "Custom") {
    return [[`${pattern} ${customValue}`, "1"]];
  }

  return [[customValue, "1"]];
}

function AddItemForm({
  products,
  categories,
  categoryFor,
  sessionId,
  onAdded,
}: {
  products: Product[];
  categories: Category[];
  categoryFor: (product: Product | undefined) => Category | undefined;
  sessionId: string;
  onAdded: () => void;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [freeTextColour, setFreeTextColour] = useState("");
  const [colourPattern, setColourPattern] = useState("Solid");
  const [colourQuantities, setColourQuantities] = useState<Record<string, string>>({});
  const [freeTextSize, setFreeTextSize] = useState("");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const category = categoryFor(selectedProduct ?? undefined);
  const isSized = (category?.sizes.length ?? 0) > 0;
  const knownColours = Array.from(
    new Set([
      ...STANDARD_COLOURS,
      ...((selectedProduct?.variants ?? []).map((v) => v.colour).filter(Boolean) as string[]),
    ])
  ).sort();
  const hasKnownColours = knownColours.length > 0;

  function handleColourQuantityChange(colour: string, quantity: string) {
    setColourQuantities((prev) => {
      const next = { ...prev };
      if (quantity === "") {
        delete next[colour];
      } else {
        next[colour] = quantity;
      }
      return next;
    });
  }

  function handleSizeQuantityChange(size: string, quantity: string) {
    setSizeQuantities((prev) => {
      const next = { ...prev };
      if (quantity === "") {
        delete next[size];
      } else {
        next[size] = quantity;
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const colourEntries = hasKnownColours
        ? resolveColourEntries(colourQuantities, freeTextColour, colourPattern)
        : resolveColourEntries({}, freeTextColour, colourPattern);
      const sizeEntries = isSized
        ? Object.entries(sizeQuantities).filter(([, qty]) => Number(qty) > 0)
        : [];

      if (hasKnownColours && colourEntries.length === 0) {
        setError("Check at least one colour and enter a quantity");
        setSubmitting(false);
        return;
      }

      if (isSized && sizeEntries.length === 0) {
        setError("Check at least one size and enter a quantity");
        setSubmitting(false);
        return;
      }

      const colourList = hasKnownColours ? colourEntries : [[freeTextColour.trim() || "", "1"]];
      const sizeList = isSized ? sizeEntries : [[freeTextSize.trim() || "", "1"]];

      for (const [colour, colourQty] of colourList) {
        const finalColour = colour.trim();
        for (const [size, sizeQty] of sizeList) {
          const finalSize = size.trim();
          await apiFetch(`/api/stock/sessions/${sessionId}/items`, {
            method: "POST",
            body: JSON.stringify({
              product_id: productId,
              colour: finalColour || null,
              size: finalSize || null,
              quantity_submitted: Number(finalColour && !isSized && finalSize === "" ? colourQty : sizeQty),
              price_submitted: price,
            }),
          });
        }
      }

      setColourQuantities({});
      setSizeQuantities({});
      setFreeTextColour("");
      setColourPattern("Solid");
      setFreeTextSize("");
      onAdded();
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item(s)");
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
          onChange={(e) => {
            setProductId(e.target.value);
            setSizeQuantities({});
          }}
          className="mt-1 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <ColourEntryGrid
        colours={knownColours}
        quantities={colourQuantities}
        onQuantityChange={handleColourQuantityChange}
        freeTextColour={freeTextColour}
        onFreeTextColourChange={setFreeTextColour}
        pattern={colourPattern}
        onPatternChange={setColourPattern}
      />

      <SizeEntryGrid
        category={category}
        quantities={sizeQuantities}
        onQuantityChange={handleSizeQuantityChange}
        freeTextSize={freeTextSize}
        onFreeTextSizeChange={setFreeTextSize}
      />

      <div>
        <label className="block text-xs text-soft-gray">
          Price (KSh) {isSized && <span className="text-soft-gray/60">(applies to all checked sizes)</span>}
        </label>
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
        {submitting ? "Adding..." : "Add Item(s)"}
      </Button>
    </form>
  );
}

/**
 * Admin-only, session-free stock receipt (PRD-equivalent section 18):
 * no session, no approval step - inventory updates the instant this
 * form submits. Kept entirely separate from the session workflow
 * above; this is for when Admin is receiving stock alone and doesn't
 * need Staff's entry -> Admin's verification round-trip at all.
 */
function DirectReceivePanel({
  products,
  categories,
  categoryFor,
}: {
  products: Product[];
  categories: Category[];
  categoryFor: (product: Product | undefined) => Category | undefined;
}) {
  const [productId, setProductId] = useState(products[0]?.id ?? "");
  const [freeTextColour, setFreeTextColour] = useState("");
  const [colourPattern, setColourPattern] = useState("Solid");
  const [colourQuantities, setColourQuantities] = useState<Record<string, string>>({});
  const [freeTextSize, setFreeTextSize] = useState("");
  const [sizeQuantities, setSizeQuantities] = useState<Record<string, string>>({});
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const selectedProduct = products.find((p) => p.id === productId) ?? null;
  const category = categoryFor(selectedProduct ?? undefined);
  const isSized = (category?.sizes.length ?? 0) > 0;
  const knownColours = Array.from(
    new Set([
      ...STANDARD_COLOURS,
      ...((selectedProduct?.variants ?? []).map((v) => v.colour).filter(Boolean) as string[]),
    ])
  ).sort();
  const hasKnownColours = knownColours.length > 0;

  function handleColourQuantityChange(colour: string, quantity: string) {
    setColourQuantities((prev) => {
      const next = { ...prev };
      if (quantity === "") {
        delete next[colour];
        return next;
      }

      const selectedColours = new Set(Object.keys(next).concat(colour));
      for (const colourName of selectedColours) {
        next[colourName] = quantity;
      }
      return next;
    });
  }

  function handleSizeQuantityChange(size: string, quantity: string) {
    setSizeQuantities((prev) => {
      const next = { ...prev };
      if (quantity === "") {
        delete next[size];
      } else {
        next[size] = quantity;
      }
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const colourEntries = hasKnownColours
        ? resolveColourEntries(colourQuantities, freeTextColour, colourPattern)
        : resolveColourEntries({}, freeTextColour, colourPattern);
      const sizeEntries = isSized
        ? Object.entries(sizeQuantities).filter(([, qty]) => Number(qty) > 0)
        : [];

      if (hasKnownColours && colourEntries.length === 0) {
        setError("Check at least one colour and enter a quantity");
        setSubmitting(false);
        return;
      }

      if (isSized && sizeEntries.length === 0) {
        setError("Check at least one size and enter a quantity");
        setSubmitting(false);
        return;
      }

      const colourList = hasKnownColours ? colourEntries : [[freeTextColour.trim() || "", "1"]];
      const sizeList = isSized ? sizeEntries : [[freeTextSize.trim() || "", "1"]];

      for (const [colour, colourQty] of colourList) {
        const finalColour = colour.trim();
        for (const [size, sizeQty] of sizeList) {
          const finalSize = size.trim();
          await apiFetch("/api/stock/direct-receive", {
            method: "POST",
            body: JSON.stringify({
              product_id: productId,
              colour: finalColour || null,
              size: finalSize || null,
              quantity: Number(finalColour && !isSized && finalSize === "" ? colourQty : sizeQty),
              price,
            }),
          });
        }
      }

      setColourQuantities({});
      setSizeQuantities({});
      setFreeTextColour("");
      setColourPattern("Solid");
      setFreeTextSize("");
      setSuccess("Stock received and inventory updated immediately - no approval needed.");
      setPrice("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to receive stock");
    } finally {
      setSubmitting(false);
    }
  }

  if (products.length === 0) return null;

  return (
    <div className="mt-10 rounded-lg border border-gold/30 bg-charcoal p-5">
      <h2 className="text-sm font-medium text-gold">Admin Direct Stock Receipt</h2>
      <p className="mt-1 text-xs text-soft-gray">
        For when Staff isn&apos;t involved - updates inventory immediately, no session or
        approval step.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-soft-gray">Product</label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setSizeQuantities({});
            }}
            className="mt-1 rounded-md border border-soft-gray/30 bg-midnight px-2 py-1 text-ivory"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <ColourEntryGrid
          colours={knownColours}
          quantities={colourQuantities}
          onQuantityChange={handleColourQuantityChange}
          freeTextColour={freeTextColour}
          onFreeTextColourChange={setFreeTextColour}
          pattern={colourPattern}
          onPatternChange={setColourPattern}
        />

        <SizeEntryGrid
          category={category}
          quantities={sizeQuantities}
          onQuantityChange={handleSizeQuantityChange}
          freeTextSize={freeTextSize}
          onFreeTextSizeChange={setFreeTextSize}
        />

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
        {success && !error && <p className="text-sm text-success">{success}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Receiving..." : "Receive Stock Now"}
        </Button>
      </form>
    </div>
  );
}