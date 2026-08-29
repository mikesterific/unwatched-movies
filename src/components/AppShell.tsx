import Link from "next/link";

const LINKS = [
  { href: "/", label: "Setup" },
  { href: "/unseen", label: "Unseen" },
  { href: "/review", label: "Review matches" },
] as const;

export function AppShell({
  children,
  current,
}: {
  children: React.ReactNode;
  current: (typeof LINKS)[number]["href"];
}) {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_#2a2118_0%,_#100e0c_42%)]">
      <header className="border-b border-line/80">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.28em] text-accent-2 uppercase">
              Local catalog
            </p>
            <h1 className="font-display text-3xl tracking-tight">
              Unseen Movies
            </h1>
          </div>
          <nav className="flex gap-2 text-sm">
            {LINKS.map((link) => {
              const active = link.href === current;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-4 py-2 transition-colors ${
                    active
                      ? "bg-accent text-white"
                      : "text-muted hover:bg-paper hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-muted">
        Watch availability is provided by JustWatch via TMDB. Catalogs are an
        approximation of US Netflix, Prime Video, Disney+, and HBO Max — not each
        service&apos;s private inventory.
      </footer>
    </div>
  );
}
