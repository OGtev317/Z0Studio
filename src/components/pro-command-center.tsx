import Link from "next/link";
import {
  zeeroStreamProBuildGates,
  zeeroStreamProPaymentLanes,
  zeeroStreamProPlans,
} from "../lib/z0studio-pro";

export function ProCommandCenter() {
  return (
    <section className="pro-command" aria-labelledby="pro-command-title">
      <div className="pro-hero">
        <p className="eyebrow">Z0Studio</p>
        <h2 id="pro-command-title">A paid creator workspace with privacy-first access control.</h2>
        <p>
          Z0Studio packages private rooms, creator receipts, tiered access, and ZeeroAgent policy
          decisions into a product that can earn revenue while the Zeero L1 protocol continues separately.
        </p>
        <div className="composer-actions">
          <Link className="button" href="#pro-pricing">View pricing</Link>
          <Link href="/receipts">Inspect receipt room</Link>
        </div>
      </div>

      <div id="pro-pricing" className="pro-plan-grid" aria-label="Z0Studio pricing">
        {zeeroStreamProPlans.map((plan) => (
          <article className="pro-plan" key={plan.id}>
            <p className="eyebrow">{plan.audience}</p>
            <h3>{plan.name}</h3>
            <strong>{plan.price}</strong>
            <span>{plan.cadence}</span>
            <ul>
              {plan.features.map((feature) => <li key={feature}>{feature}</li>)}
            </ul>
            <Link className={plan.id === "pro" ? "button" : "button secondary"} href="/pro#payment-lanes">
              {plan.id === "free" ? "Preview" : "Prepare checkout"}
            </Link>
          </article>
        ))}
      </div>

      <div id="payment-lanes" className="pro-lanes" aria-label="Payment and token lanes">
        <div>
          <p className="eyebrow">Payment lanes</p>
          <h3>Fast UX without handing off Zeero security.</h3>
        </div>
        {zeeroStreamProPaymentLanes.map((lane) => (
          <article key={lane.id}>
            <span>{lane.status}</span>
            <h4>{lane.label}</h4>
            <p>{lane.provider}</p>
            <small>{lane.boundary}</small>
          </article>
        ))}
      </div>

      <div className="pro-gates" aria-label="Pro build gates">
        {zeeroStreamProBuildGates.map((gate) => <p key={gate}>{gate}</p>)}
      </div>
    </section>
  );
}
