import Link from "next/link";
import type { ReactNode } from "react";
import { AccountControl } from "./account-control";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/profiles", label: "Explore" },
  { href: "/rooms", label: "Rooms" },
  { href: "/messages", label: "Messages" },
  { href: "/receipts", label: "Passes" },
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
          <Link className="button social-compose" href="/pro">Start creating</Link>
          <AccountControl />
        </aside>

        <section className="social-main" aria-labelledby="page-title">
          <header className="social-header">
            <p className="eyebrow">{kicker}</p>
            <div className="social-title-lockup">
              <img src="/zeero-layer-2-logo.png" alt="" width="56" height="56" />
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
              <h2>Start here</h2>
              <p>Find a creator, follow the conversation, then join the rooms that matter to you.</p>
              <dl>
                <div><dt>1</dt><dd>Explore creators</dd></div>
                <div><dt>2</dt><dd>Join a room</dd></div>
                <div><dt>3</dt><dd>Unlock what you love</dd></div>
              </dl>
            </>
          )}
        </aside>
      </main>
      <footer className="social-footer"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></footer>
    </>
  );
}
