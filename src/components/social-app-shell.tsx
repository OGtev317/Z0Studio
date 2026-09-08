import Link from "next/link";
import type { ReactNode } from "react";
import { CodeRain } from "./code-rain";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/pro", label: "Pro" },
  { href: "/rooms", label: "Rooms" },
  { href: "/profiles", label: "Profiles" },
  { href: "/messages", label: "Messages" },
  { href: "/receipts", label: "Receipts" },
] as const;

type SocialAppShellProps = {
  active: "home" | "pro" | "rooms" | "profiles" | "messages" | "receipts";
  title: string;
  kicker: string;
  children: ReactNode;
  aside?: ReactNode;
};

export function SocialAppShell({ active, title, kicker, children, aside }: SocialAppShellProps) {
  const isActive = (href: string) => {
    if (active === "home" && href === "/") return true;
    return href === `/${active}`;
  };

  return (
    <>
      <a className="skip-link" href="#content">Skip to content</a>
      <CodeRain />
      <main id="content" className="social-app">
        <aside className="social-rail" aria-label="Primary">
          <Link className="social-brand" href="/">
            <img src="/zeero-layer-2-logo.png" alt="" width="64" height="64" />
            <span>Z0Studio</span>
          </Link>
          <nav className="social-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link className={isActive(item.href) ? "active" : ""} href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          <Link className="button social-compose" href="/pro">Open Pro</Link>
        </aside>

        <section className="social-main" aria-labelledby="page-title">
          <header className="social-header">
            <p className="eyebrow">{kicker}</p>
            <div className="social-title-lockup">
              <img src="/zeero-layer-2-logo.png" alt="" width="108" height="108" />
              <div>
                <p className="social-product-name">Z0Studio</p>
                <h1 id="page-title">{title}</h1>
              </div>
            </div>
          </header>
          {children}
        </section>

        <aside className="social-context" aria-label="Context">
          {aside ?? (
            <>
              <h2>Privacy edge</h2>
              <p>Creators get paid access, receipt-bound rooms, and privacy policy automation without making Zeero L1 launch claims.</p>
              <dl>
                <div><dt>Product</dt><dd>Pro workspace</dd></div>
                <div><dt>Agent</dt><dd>Access policy brain</dd></div>
                <div><dt>L1</dt><dd>Future native lane</dd></div>
              </dl>
            </>
          )}
        </aside>
      </main>
    </>
  );
}
