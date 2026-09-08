import { CreatorRoomAccessFlow } from "../../components/creator-room-access-flow";
import { OpenSocialHub } from "../../components/open-social-hub";
import { SocialAppShell } from "../../components/social-app-shell";
import { ZeeroAgentAccessBrain } from "../../components/zeeroagent-access-brain";

export default function RoomsPage() {
  return (
    <SocialAppShell
      active="rooms"
      kicker="Open timeline plus gated rooms"
      title="Creators can talk publicly and sell access privately."
      aside={<RoomsAside />}
    >
      <OpenSocialHub />
      <CreatorRoomAccessFlow />
      <ZeeroAgentAccessBrain />
    </SocialAppShell>
  );
}

function RoomsAside() {
  return (
    <>
      <h2>Access model</h2>
      <p>Open communication and paid rooms live side by side. Public posts never grant room access by themselves.</p>
      <dl>
        <div><dt>Public</dt><dd>Timeline and replies</dd></div>
        <div><dt>Room</dt><dd>Paid member feed</dd></div>
        <div><dt>Drop</dt><dd>Extra unlock</dd></div>
        <div><dt>Agent</dt><dd>Policy decision</dd></div>
      </dl>
    </>
  );
}
