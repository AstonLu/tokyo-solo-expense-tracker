"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function ReceiptIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M5 3h12v16l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4V3z"
        stroke="currentColor"
        strokeWidth={active ? 1.8 : 1.5}
        strokeLinejoin="round"
      />
      <path
        d="M8 8h6M8 11h6M8 14h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MapPinIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <path
        d="M11 3C8.24 3 6 5.24 6 8c0 4.5 5 11 5 11s5-6.5 5-11c0-2.76-2.24-5-5-5z"
        stroke="currentColor"
        strokeWidth={active ? 1.8 : 1.5}
        strokeLinejoin="round"
      />
      <circle cx="11" cy="8" r="1.8" fill="currentColor" />
    </svg>
  );
}

const TABS = [
  { href: "/dashboard", label: "記帳", Icon: ReceiptIcon },
  { href: "/itinerary", label: "行程", Icon: MapPinIcon },
];

export default function BottomNav() {
  const path = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-[var(--surface)]/95 backdrop-blur border-t border-[var(--border)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="max-w-md mx-auto flex">
        {TABS.map(({ href, label, Icon }) => {
          const active = path === href || (href === "/dashboard" && path === "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors active:scale-95 ${
                  active
                    ? "text-[var(--accent)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon active={active} />
                <span
                  className={`text-[10px] tracking-wide ${
                    active ? "font-semibold" : "font-medium"
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
