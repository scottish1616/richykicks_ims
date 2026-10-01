"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { apiFetch } from "../../lib/api";
import Button from "../../components/Button";
import NavBar from "../../components/NavBar";
import ReceivingBuilder from "./ReceivingBuilder";
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

      // Staff are routed to the currently open intake session without
      // having to select or understand the internal session workflow.
      const linked = searchParams.get("session");
      setSelectedSessionId((previous) => {
        if (linked && sessionsData.some((session) => session.id === linked)) return linked;
        if (user?.role === "staff") {
          return sessionsData.find((session) => session.status === "open")?.id ?? null;
        }
        return previous ?? sessionsData[0]?.id ?? null;
      });
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
  const activeStaffSessionExists = sessions.some((session) =>
    ["open", "staff_completed", "closed"].includes(session.status)
  );

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
        <h1 className="text-2xl font-semibold text-ivory">Stock Receiving</h1>

        {error && <p className="mt-4 text-sm text-error">{error}</p>}
        {actionError && <p className="mt-4 text-sm text-error">{actionError}</p>}

        <div className="mt-6">
          {isAdmin ? (
            <ReceivingBuilder
              products={products}
              categories={categories}
              mode="direct"
              onDirectSubmitted={() => {
                apiFetch<Product[]>("/api/products").then(setProducts).catch(() => undefined);
              }}
            />
          ) : selectedSession?.status === "open" ? (
            <ReceivingBuilder
              products={products}
              categories={categories}
              mode="staff"
              sessionId={selectedSession.id}
              onStaffSubmitted={(updated) => {
                updateSessionInPlace(updated);
                setSelectedSessionId(updated.id);
                void loadItems(updated.id);
              }}
            />
          ) : (
            <div className="rounded-xl border border-soft-gray/20 bg-charcoal p-5">
              <h2 className="text-lg font-medium text-ivory">No receiving intake is open</h2>
              <p className="mt-1 text-sm text-soft-gray">
                Ask an Admin to start staff receiving. Stock is only added after Admin approval.
              </p>
            </div>
          )}
        </div>

        {isAdmin ? (
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-ivory">Staff receiving review</h2>
                <p className="mt-1 text-sm text-soft-gray">
                  Staff submissions remain pending until you review and approve them.
                </p>
              </div>
              <Button onClick={handleOpenSession} disabled={activeStaffSessionExists}>
                {activeStaffSessionExists ? "Staff Receiving Active" : "Open Staff Receiving"}
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-1">
                <ul className="space-y-2">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <button
                        onClick={() => setSelectedSessionId(session.id)}
                        className={`w-full rounded-lg border px-3 py-3 text-left text-sm ${
                          session.id === selectedSessionId
                            ? "border-gold text-gold"
                            : "border-soft-gray/20 text-soft-gray hover:text-ivory"
                        }`}
                      >
                        <div>{new Date(session.opened_at).toLocaleString()}</div>
                        <StatusBadge status={session.status} />
                      </button>
                    </li>
                  ))}
                  {sessions.length === 0 && <li className="text-sm text-soft-gray">No staff submissions yet.</li>}
                </ul>
              </div>
              <div className="md:col-span-2">
                {selectedSession ? (
                  <SessionPanel
                    session={selectedSession}
                    items={items}
                    isAdmin={isAdmin}
                    productName={productName}
                    onComplete={handleComplete}
                    onCancel={handleCancel}
                    onClose={handleClose}
                    onApprove={handleApprove}
                    onReject={handleReject}
                    onReopen={handleReopen}
                    onItemCorrected={(updated) =>
                      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
                    }
                  />
                ) : (
                  <p className="text-sm text-soft-gray">No staff receiving session selected.</p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="mt-8 rounded-xl border border-soft-gray/20 bg-charcoal p-4">
            <h2 className="text-sm font-semibold text-ivory">Recent receiving status</h2>
            <ul className="mt-3 space-y-2">
              {sessions.slice(0, 3).map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-soft-gray">{new Date(session.opened_at).toLocaleString()}</span>
                  <StatusBadge status={session.status} />
                </li>
              ))}
              {sessions.length === 0 && <li className="text-sm text-soft-gray">No recent receiving activity.</li>}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function SessionPanel({
  session,
  items,
  isAdmin,
  productName,
  onComplete,
  onCancel,
  onClose,
  onApprove,
  onReject,
  onReopen,
  onItemCorrected,
}: {
  session: ReceivingSession;
  items: ReceivingItem[];
  isAdmin: boolean;
  productName: (id: string) => string;
  onComplete: () => void;
  onCancel: () => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onReopen: (reason: string) => void;
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

      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            productName={productName(item.product_id)}
            canCorrect={canCorrect}
            onCorrected={onItemCorrected}
          />
        ))}
        {items.length === 0 && <p className="py-4 text-sm text-soft-gray">No items yet.</p>}
      </div>

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
    <article className="rounded-lg border border-soft-gray/15 bg-midnight/70 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="break-words font-medium text-ivory">{productName}</h3>
          <p className="mt-1 text-sm text-soft-gray">
            {[item.colour, item.size].filter(Boolean).join(" · ") || "No colour or size variant"}
          </p>
        </div>
        <StatusBadge status={item.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-soft-gray">Submitted</p>
          <p className="mt-0.5 text-ivory">
            {item.quantity_submitted} × KSh {Number(item.price_submitted).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-xs text-soft-gray">Approved</p>
          <p className="mt-0.5 text-ivory">
            {item.quantity_approved ?? "—"}
            {item.price_approved ? ` × KSh ${Number(item.price_approved).toLocaleString()}` : ""}
          </p>
        </div>
      </div>
      {canCorrect && (
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-soft-gray/10 pt-3">
          <label className="w-24 text-xs text-soft-gray">
            Approved qty
            <input
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-2 py-2 text-sm text-ivory"
            />
          </label>
          <label className="w-32 text-xs text-soft-gray">
            Approved price
            <input
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="mt-1 w-full rounded-md border border-soft-gray/30 bg-charcoal px-2 py-2 text-sm text-ivory"
            />
          </label>
          <Button variant="secondary" onClick={handleSave} disabled={saving}>
            Save correction
          </Button>
        </div>
      )}
    </article>
  );
}

const COMMON_COLOURS = ["Black", "White", "Red", "Blue", "Grey"];

/**
 * Shared colour-entry UI for per-session and direct stock receiving.
 * Five common colours are shown first; less common product colours can
 * be added from a dropdown. One quantity applies to the selected combo.
 */
function ColourEntryGrid({
  colours,
  quantities,
  onColourToggle,
  onQuantityChange,
  freeTextColour,
  onFreeTextColourChange,
  pattern,
  onPatternChange,
}: {
  colours: string[];
  quantities: Record<string, string>;
  onColourToggle: (colour: string, selected: boolean) => void;
  onQuantityChange: (quantity: string) => void;
  freeTextColour: string;
  onFreeTextColourChange: (value: string) => void;
  pattern: string;
  onPatternChange: (value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [additionalColour, setAdditionalColour] = useState("");
  const selectedCount = Object.keys(quantities).length;
  const selectedColours = Object.keys(quantities);
  const sharedQuantity = selectedColours.length > 0 ? quantities[selectedColours[0]] ?? "" : "";
  const visibleColours = [
    ...COMMON_COLOURS.filter((commonColour) =>
      colours.some((colour) => colour.toLowerCase() === commonColour.toLowerCase())
    ),
    ...selectedColours.filter(
      (colour) => !COMMON_COLOURS.some((commonColour) => commonColour.toLowerCase() === colour.toLowerCase())
    ),
  ];
  const additionalColours = colours.filter(
    (colour) =>
      !COMMON_COLOURS.some((commonColour) => commonColour.toLowerCase() === colour.toLowerCase()) &&
      !(colour in quantities)
  );
  const quantityPresets = ["1", "2", "3", "4", "5", "10", "20", "50", "100"];

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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visibleColours.map((colour) => {
              const checked = colour in quantities;
              return (
                <div
                  key={colour}
                  className={`flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 ${
                    checked ? "border-gold bg-gold/5" : "border-soft-gray/30"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onColourToggle(colour, e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-gold"
                  />
                  <span className="text-sm text-ivory">{colour}</span>
                </div>
              );
            })}
          </div>
          {additionalColours.length > 0 && (
            <div className="mt-3">
              <label className="block text-[10px] uppercase tracking-wide text-soft-gray/80">
                More colours
              </label>
              <select
                value={additionalColour}
                onChange={(e) => {
                  const colour = e.target.value;
                  if (colour) onColourToggle(colour, true);
                  setAdditionalColour("");
                }}
                className="mt-1 w-full rounded-md border border-soft-gray/30 bg-midnight px-2 py-2 text-sm text-ivory"
              >
                <option value="">Add another colour...</option>
                {additionalColours.map((colour) => (
                  <option key={colour} value={colour}>
                    {colour}
                  </option>
                ))}
              </select>
            </div>
          )}
          {selectedCount > 0 && (
            <div className="mt-3 rounded-md border border-soft-gray/20 p-3">
              <label className="block text-[10px] uppercase tracking-wide text-soft-gray/80">
                Quantity for selected colours
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <select
                  value={sharedQuantity}
                  onChange={(e) => onQuantityChange(e.target.value)}
                  className="rounded-md border border-soft-gray/30 bg-midnight px-2 py-2 text-sm text-ivory"
                >
                  <option value="">Choose quantity</option>
                  {sharedQuantity && !quantityPresets.includes(sharedQuantity) && (
                    <option value={sharedQuantity}>{sharedQuantity} (custom)</option>
                  )}
                  {quantityPresets.map((quantity) => (
                    <option key={quantity} value={quantity}>
                      {quantity}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={sharedQuantity}
                  onChange={(e) => onQuantityChange(e.target.value)}
                  aria-label="Enter stock quantity"
                  placeholder="Enter quantity"
                  className="w-32 rounded-md border border-soft-gray/30 bg-midnight px-2 py-2 text-sm text-ivory"
                />
              </div>
            </div>
          )}
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

  function handleColourQuantityChange(quantity: string) {
    setColourQuantities((prev) => {
      return Object.fromEntries(Object.keys(prev).map((colour) => [colour, quantity]));
    });
  }

  function handleColourToggle(colour: string, selected: boolean) {
    setColourQuantities((prev) => {
      const next = { ...prev };
      if (selected) {
        next[colour] = Object.values(prev)[0] || "1";
      } else {
        delete next[colour];
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
        onColourToggle={handleColourToggle}
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

  function handleColourQuantityChange(quantity: string) {
    setColourQuantities((prev) => {
      return Object.fromEntries(Object.keys(prev).map((colourName) => [colourName, quantity]));
    });
  }

  function handleColourToggle(colour: string, selected: boolean) {
    setColourQuantities((prev) => {
      const next = { ...prev };
      if (selected) {
        next[colour] = Object.values(prev)[0] || "1";
      } else {
        delete next[colour];
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
          onColourToggle={handleColourToggle}
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