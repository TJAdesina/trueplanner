import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-charcoal/10 bg-cream/90 backdrop-blur">
      <nav className="content-wrap flex h-16 items-center justify-between">
        <Link href="/" aria-label="TruePlanner home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-charcoal/75 transition-colors hover:text-charcoal"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-charcoal/75 hover:text-charcoal sm:inline-block"
          >
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start planning
          </Link>
        </div>
      </nav>
    </header>
  );
}
