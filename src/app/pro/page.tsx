import { MarketplaceWorkspace } from "../../components/marketplace-workspace";
import { PrivacyPaymentSetup } from "../../components/privacy-payment-setup";
import { ProCommandCenter } from "../../components/pro-command-center";
import { PrivatePaymentMvp } from "../../components/private-payment-mvp";
import { SocialAppShell } from "../../components/social-app-shell";
import { SubscriptionPlanner } from "../../components/subscription-planner";
import { ZeeroAgentAccessBrain } from "../../components/zeeroagent-access-brain";

export default function ProPage() {
  return (
    <SocialAppShell
      active="pro"
      kicker="Creator operating room"
      title="Run paid access without exposing the whole relationship graph."
      aside={<ProAside />}
    >
      <ProCommandCenter />
      <PrivacyPaymentSetup />
      <PrivatePaymentMvp />
      <ZeeroAgentAccessBrain />
      <MarketplaceWorkspace />
      <SubscriptionPlanner />
    </SocialAppShell>
  );
}

function ProAside() {
  return (
    <>
      <h2>Pro boundary</h2>
      <p>Z0Studio is the revenue product copy. The hackathon deployment stays frozen until judging closes.</p>
      <dl>
        <div><dt>Login</dt><dd>Wallet first</dd></div>
        <div><dt>Payment</dt><dd>STRK20 primary</dd></div>
        <div><dt>Token</dt><dd>Z0Pass receipts</dd></div>
        <div><dt>L1</dt><dd>Separate protocol asset</dd></div>
      </dl>
    </>
  );
}
