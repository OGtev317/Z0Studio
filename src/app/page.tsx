import Link from "next/link";
import { PrivateCreatorReceiptRoom } from "../components/private-creator-receipt-room";
import { PrivatePaymentMvp } from "../components/private-payment-mvp";
import { ProCommandCenter } from "../components/pro-command-center";
import { PublicSocialFeed } from "../components/public-social-feed";
import { SocialAppShell } from "../components/social-app-shell";
import { ZeeroAgentAccessBrain } from "../components/zeeroagent-access-brain";
import { socialPosts } from "../lib/social-content";

export default function Home() {
  return (
    <SocialAppShell
      active="home"
      kicker="Frozen hackathon base, Pro workspace copy"
      title="ZeeroStream Pro starts from the shipped privacy creator demo."
      aside={<HomeAside />}
    >
      <section className="feed-composer" aria-label="Private checkout prompt">
        <div className="composer-avatar" aria-hidden="true">ZS</div>
        <div>
          <h2>Build paid creator access without touching the judged deployment.</h2>
          <p>This copy keeps the hackathon evidence intact and adds a Pro path for login, checkout, rooms, receipts, and ZeeroAgent access logic.</p>
          <div className="composer-actions">
            <Link className="button" href="/pro">Open Pro workspace</Link>
            <Link href="/receipts">View receipt room</Link>
          </div>
        </div>
      </section>

      <section className="social-tabs" aria-label="Home filters">
        <Link className="active" href="/">For you</Link>
        <Link href="/profiles">Creators</Link>
        <Link href="/messages">Encrypted messages</Link>
        <Link href="/receipts">Receipts</Link>
      </section>

      <ProCommandCenter />
      <PublicSocialFeed seedPosts={socialPosts} />

      <ZeeroAgentAccessBrain />
      <PrivateCreatorReceiptRoom />
      <PrivatePaymentMvp />
    </SocialAppShell>
  );
}

function HomeAside() {
  return (
    <>
      <h2>Artifact split</h2>
      <p>The public hackathon page remains frozen; this local workspace is the Pro product copy.</p>
      <dl>
        <div><dt>Live page</dt><dd>Frozen</dd></div>
        <div><dt>Pro copy</dt><dd>Local build</dd></div>
        <div><dt>Agent</dt><dd>Access brain</dd></div>
        <div><dt>Payments</dt><dd>Design-gated</dd></div>
      </dl>
      <Link className="context-link" href="/receipts">Open receipt evidence</Link>
    </>
  );
}
