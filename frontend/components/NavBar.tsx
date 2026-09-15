"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import Button from "./Button";
import NotificationBell from "./NotificationBell";

const ADMIN_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/sales", label: "Sales" },
  { href: "/receiving", label: "Receiving" },
  { href: "/reports", label: "Reports" },
  { href: "/staff", label: "Staff" },
  { href: "/settings", label: "Settings" },
  { href: "/audit", label: "Audit Log" },
  { href: "/account", label: "My Account" },
];

const STAFF_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/sales", label: "Sales" },
  { href: "/receiving", label: "Receiving" },
  { href: "/reports", label: "Reports" },
  { href: "/account", label: "My Account" },
];

export default function NavBar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const links = user.role === "admin" ? ADMIN_LINKS : STAFF_LINKS;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <nav className="border-b border-soft-gray/20 bg-charcoal">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-ivory">
            Richy<span className="text-gold">Kicks</span>
          </span>
          <div className="hidden gap-4 sm:flex">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={
                  pathname === link.href
                    ? "text-sm text-gold"
                    : "text-sm text-soft-gray hover:text-ivory"
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <Button variant="secondary" onClick={handleLogout} className="hidden sm:inline-flex">
            Logout
          </Button>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-soft-gray/30 text-ivory sm:hidden"
          >
            {menuOpen ? "\u2715" : "\u2630"}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-soft-gray/20 px-6 py-3 sm:hidden">
          <div className="flex flex-col gap-3">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={
                  pathname === link.href
                    ? "text-sm text-gold"
                    : "text-sm text-soft-gray hover:text-ivory"
                }
              >
                {link.label}
              </Link>
            ))}
            <Button variant="secondary" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
