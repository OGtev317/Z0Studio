import Link from "next/link";
import { zeeroStreamProPlans } from "../lib/z0studio-pro";

export function ProCommandCenter() {
  return (
    <section className="pro-command" aria-labelledby="pro-command-title">
      <div className="pro-hero">
        <p className="eyebrow">Z0Studio</p>
        <h2 id="pro-command-title">Turn the people who follow your work into a real community.</h2>
        <p>
          Start with your public profile. When people are ready for more, give them a room,
          a membership, and a reason to stay.
        </p>
        <div className="composer-actions">
          <Link className="button" href="#room-templates">Choose a room</Link>
          <Link href="/profiles">View creator profiles</Link>
        </div>
      </div>

      <section className="creator-start-steps" aria-label="Start creating">
        <article><span>01</span><h3>Build your profile</h3><p>Give people a clear reason to follow you.</p></article>
        <article><span>02</span><h3>Choose your room</h3><p>Start with a space that fits your community.</p></article>
        <article><span>03</span><h3>Invite your members</h3><p>Share posts, drops, and direct access in one place.</p></article>
      </section>

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
            <Link className={plan.id === "pro" ? "button" : "button secondary"} href="#room-templates">
              {plan.id === "free" ? "Choose a room" : "Explore room templates"}
            </Link>
          </article>
        ))}
      </div>

    </section>
  );
}
