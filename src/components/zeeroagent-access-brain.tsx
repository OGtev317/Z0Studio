import { zSocialGraphSnapshot } from "../lib/z-social-graph-demo";

const actionCopy: Record<string, string> = {
  "follow-request": "Request",
  "follow-accept": "Accept",
  "follow-block": "Block",
  "permission-edge": "Permit",
  "feed-delivery": "Deliver",
};

export function ZeeroAgentAccessBrain() {
  return (
    <section className="agent-brain" aria-labelledby="agent-brain-title">
      <div className="agent-brain-heading">
        <div>
          <p className="eyebrow">ZeeroAgent access brain</p>
          <h2 id="agent-brain-title">Private creator relationships without a public social graph.</h2>
          <p>
            ZeeroAgent models who can request, enter, lose, or receive creator access. ZeeroStream uses that
            as a product layer around receipt-bound access, while wallets keep private state, notes, and proofs.
          </p>
        </div>
        <dl className="agent-brain-stats" aria-label="Z-social graph demo summary">
          <div><dt>Accepted</dt><dd>{zSocialGraphSnapshot.acceptedFollowers}</dd></div>
          <div><dt>Blocked</dt><dd>{zSocialGraphSnapshot.blockedFollowers}</dd></div>
          <div><dt>Delivered</dt><dd>{zSocialGraphSnapshot.feedDeliveries}</dd></div>
        </dl>
      </div>

      <div className="agent-graph" aria-label="ZeeroAgent local access graph events">
        {zSocialGraphSnapshot.events.map((event, index) => (
          <article className={`agent-node ${event.kind}`} key={event.id}>
            <span>{index + 1}</span>
            <div>
              <small>{actionCopy[event.kind]}</small>
              <h3>{event.label}</h3>
              <p>{event.visibleClaim}</p>
              <code>{event.actor} {"->"} {event.target}</code>
            </div>
          </article>
        ))}
      </div>

      <div className="agent-boundary">
        <p>
          Live read-only demo using synthetic relationships from {zSocialGraphSnapshot.source}.
          Decisions illustrate access policy; they do not authenticate viewers, verify receipt ownership, or grant protected access.
        </p>
        <div aria-label="Hidden fields">
          {zSocialGraphSnapshot.hiddenFields.map((field) => <span key={field}>{field}</span>)}
        </div>
        <a className="agent-live-link" href="/api/zeeroagent?viewer=subscriber-8f2">Open live read-only agent endpoint</a>
      </div>
    </section>
  );
}
