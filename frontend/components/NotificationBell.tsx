"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../lib/api";
import type { Notification } from "../types";

const POLL_INTERVAL_MS = 30000;

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function refreshUnreadCount() {
    try {
      const { count } = await apiFetch<{ count: number }>("/api/notifications/unread-count");
      setUnreadCount(count);
    } catch {
      // Silently ignore - the bell just won't update this cycle.
    }
  }

  useEffect(() => {
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      try {
        const data = await apiFetch<Notification[]>("/api/notifications");
        setNotifications(data);
        setLoaded(true);
      } catch {
        // leave the dropdown showing "couldn't load" via empty state
      }
    }
  }

  async function handleNotificationClick(n: Notification) {
    if (!n.is_read) {
      try {
        await apiFetch(`/api/notifications/${n.id}/read`, { method: "POST" });
        setNotifications((prev) =>
          prev.map((item) => (item.id === n.id ? { ...item, is_read: true } : item))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // navigate anyway even if marking read failed
      }
    }
    setOpen(false);
    if (n.receiving_session_id) {
      router.push(`/receiving?session=${n.receiving_session_id}`);
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-soft-gray/30 text-ivory hover:border-gold"
      >
        <span aria-hidden="true">&#128276;</span>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-ivory">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-soft-gray/20 bg-charcoal shadow-lg">
          <div className="flex items-center justify-between border-b border-soft-gray/10 px-4 py-2">
            <span className="text-sm font-medium text-ivory">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs text-gold hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-soft-gray">
                No notifications yet.
              </p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => handleNotificationClick(n)}
                className={`block w-full border-b border-soft-gray/10 px-4 py-3 text-left last:border-b-0 hover:bg-midnight ${
                  n.is_read ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-ivory">{n.title}</span>
                  {!n.is_read && (
                    <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-gold" />
                  )}
                </div>
                <p className="mt-1 text-xs text-soft-gray">{n.message}</p>
                <p className="mt-1 text-[11px] text-soft-gray/60">
                  {new Date(n.created_at).toLocaleString()}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
