import { CreatorRoomAccessFlow } from "../../components/creator-room-access-flow";
import { CreatorWorkspace } from "../../components/creator-workspace";
import { ProCommandCenter } from "../../components/pro-command-center";
import { SocialAppShell } from "../../components/social-app-shell";

export default function ProPage() {
  return (
    <SocialAppShell
      active="pro"
      kicker="Creator studio"
      title="Build the space your community comes back to."
      aside={<ProAside />}
    >
      <ProCommandCenter />
      <CreatorWorkspace />
      <section id="room-templates" className="creator-template-section" aria-label="Choose a room template">
        <div>
          <p className="eyebrow">Room templates</p>
          <h2>Start with the room that matches your community.</h2>
          <p>Choose a simple member room, a focused cohort, or a space made for drops.</p>
        </div>
        <CreatorRoomAccessFlow showRooms={false} showTemplates />
      </section>
    </SocialAppShell>
  );
}

function ProAside() {
  return (
    <>
      <h2>Your creator space</h2>
      <p>Create a recognizable home for the people who care about your work.</p>
      <dl>
        <div><dt>Profile</dt><dd>Your public home</dd></div>
        <div><dt>Room</dt><dd>Your member space</dd></div>
        <div><dt>Membership</dt><dd>Your recurring support</dd></div>
      </dl>
    </>
  );
}
