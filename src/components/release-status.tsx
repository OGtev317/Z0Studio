const releaseItems = [
  {
    label: "Public demo",
    state: "Ready",
    detail: "Static production build on Cloudflare Pages.",
    tone: "ready",
  },
  {
    label: "Wallet path",
    state: "Review only",
    detail: "Capability check, network check, exact pool check, and wallet dry run.",
    tone: "review",
  },
  {
    label: "Mainnet contracts",
    state: "Locked",
    detail: "Independent review, production verifier, ceremony, and attestor gates remain open.",
    tone: "locked",
  },
  {
    label: "Sprint evidence",
    state: "3 / 3",
    detail: "Three accepted Mainnet pool receipts and a public MP4 demo are claimed.",
    tone: "ready",
  },
] as const;

export function ReleaseStatus() {
  return (
    <section className="release-status" aria-labelledby="release-status-title">
      <div className="release-status-heading">
        <div>
          <p className="eyebrow">Live release state</p>
          <h2 id="release-status-title">What works, what is gated, what comes next.</h2>
        </div>
        <a className="secondary button" href="/strk20.json">
          View strk20.json
        </a>
      </div>
      <div className="release-grid">
        {releaseItems.map((item) => (
          <article key={item.label} className={`release-card release-${item.tone}`}>
            <p>{item.label}</p>
            <strong>{item.state}</strong>
            <span>{item.detail}</span>
          </article>
        ))}
      </div>
      <p className="release-note">
        The demo is public. Contract declaration, deployment, signatures, and fund movement are not
        authorized by this page and remain fail-closed.
      </p>
    </section>
  );
}
