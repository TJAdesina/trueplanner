"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Settings, Moon } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/dashboard", label: "Today" },
  { href: "/dashboard/end-of-day", label: "End of day", icon: Moon },
];

export function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-charcoal/10 bg-white">
      <div className="content-wrap flex h-16 items-center justify-between">
        <Link href="/dashboard">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-forest/10 text-forest" : "text-charcoal/60 hover:text-charcoal"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          <Link
            href="/dashboard/settings"
            className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal/55 hover:bg-charcoal/5 hover:text-charcoal"
            aria-label="Settings"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </Link>
          <button
            onClick={signOut}
            className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal/55 hover:bg-charcoal/5 hover:text-charcoal"
            aria-label="Sign out"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-charcoal/10 px-5 py-2 sm:hidden">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${
                active ? "bg-forest/10 text-forest" : "text-charcoal/60"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
