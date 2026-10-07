"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Beranda", dot: "bg-sky" },
  { href: "/embed", label: "Embed", dot: "bg-sun" },
  { href: "/extract", label: "Extract", dot: "bg-teal" },
  { href: "/attack-lab", label: "Attack Lab", dot: "bg-coral" },
  { href: "/compare", label: "Compare", dot: "bg-grape" },
];

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigasi utama" className="flex items-center gap-1.5">
      {NAV.map((n) => {
        const active = pathname === n.href;
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={active ? "page" : undefined}
            className={`group flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${
              active
                ? "bg-foreground text-paper -translate-y-px shadow-pop-coral"
                : "text-muted hover:bg-sun/15 hover:text-foreground"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full transition-transform duration-200 ${n.dot} ${
                active ? "scale-125" : "scale-90 group-hover:scale-110"
              }`}
            />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
