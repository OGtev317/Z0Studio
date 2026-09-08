import Link from "next/link";
import { PrivateCreatorReceiptRoom } from "../../components/private-creator-receipt-room";
import { SocialAppShell } from "../../components/social-app-shell";
import { receiptSummaries } from "../../lib/social-content";

export default function ReceiptsPage() {
  return (
    <SocialAppShell
      active="receipts"
      kicker="Receipt evidence"
      title="Public hashes prove pool use. Z keeps the creator relationship private."
      aside={<ReceiptsAside />}
    >
      <section className="receipt-ledger" aria-label="Receipt ledger">
        {receiptSummaries.map((receipt) => (
          <article className="ledger-row" key={receipt.hash}>
            <span>{receipt.step}</span>
            <div>
              <h2>{receipt.role}</h2>
              <p>{receipt.detail}</p>
              <small>{receipt.visibility} · {receipt.route}</small>
              <a href={`https://voyager.online/tx/${receipt.hash}`} target="_blank" rel="noreferrer">{receipt.hash}</a>
            </div>
          </article>
        ))}
      </section>
      <PrivateCreatorReceiptRoom />
    </SocialAppShell>
  );
}

function ReceiptsAside() {
  return (
    <>
      <h2>Judge links</h2>
      <p>Use these routes to evaluate the shipped app without signing a new transaction.</p>
      <dl>
        <div><dt>Manifest</dt><dd><Link href="/strk20.json">strk20.json</Link></dd></div>
        <div><dt>Video</dt><dd><Link href="/zeerostream-demo.mp4">Demo MP4</Link></dd></div>
        <div><dt>Checkout</dt><dd><Link href="/#pay">Private pay</Link></dd></div>
      </dl>
    </>
  );
}
