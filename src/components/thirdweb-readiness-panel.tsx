import { getZ0StudioThirdwebStatus } from "../lib/z0studio-thirdweb";

export function ThirdwebReadinessPanel() {
  const status = getZ0StudioThirdwebStatus({
    NEXT_PUBLIC_THIRDWEB_CLIENT_ID: process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID,
    NEXT_PUBLIC_Z0STUDIO_PRO_CHECKOUT_ID: process.env.NEXT_PUBLIC_Z0STUDIO_PRO_CHECKOUT_ID,
    NEXT_PUBLIC_Z0STUDIO_STUDIO_CHECKOUT_ID: process.env.NEXT_PUBLIC_Z0STUDIO_STUDIO_CHECKOUT_ID,
    NEXT_PUBLIC_Z0STUDIO_ZPRO_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_Z0STUDIO_ZPRO_TOKEN_ADDRESS,
  });

  return (
    <section className="thirdweb-readiness" aria-labelledby="thirdweb-readiness-title">
      <div>
        <p className="eyebrow">thirdweb readiness</p>
        <h2 id="thirdweb-readiness-title">Login and checkout stay disabled until configuration is reviewed.</h2>
        <p>
          Z0Studio can add thirdweb social login, checkout, and app-credit references without making thirdweb
          part of Zeero consensus, settlement, proof verification, or L1 currency policy.
        </p>
      </div>
      <div className="thirdweb-lanes">
        {status.lanes.map((lane) => (
          <article className={lane.enabled ? "ready" : "locked"} key={lane.id}>
            <span>{lane.enabled ? "Configured" : "Locked"}</span>
            <h3>{lane.label}</h3>
            <p>{lane.reason}</p>
          </article>
        ))}
      </div>
      <div className="thirdweb-boundaries">
        {status.boundaries.map((boundary) => <p key={boundary}>{boundary}</p>)}
      </div>
    </section>
  );
}
