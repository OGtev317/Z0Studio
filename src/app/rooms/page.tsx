import { CreatorRoomAccessFlow } from "../../components/creator-room-access-flow";
import { ManagedRoomDirectory } from "../../components/managed-room-directory";
import { SocialAppShell } from "../../components/social-app-shell";

export default function RoomsPage() {
  return (
    <SocialAppShell
      active="rooms"
      kicker="Creator rooms"
      title="Join the communities where the real work happens."
      aside={<RoomsAside />}
    >
      <ManagedRoomDirectory />
      <CreatorRoomAccessFlow />
    </SocialAppShell>
  );
}

function RoomsAside() {
  return (
    <>
      <h2>Find your room</h2>
      <p>Follow creators in public, then join the member spaces that fit what you are here for.</p>
      <dl>
        <div><dt>Open feed</dt><dd>See what is new</dd></div>
        <div><dt>Room</dt><dd>Meet the community</dd></div>
        <div><dt>Drop</dt><dd>Unlock extras</dd></div>
      </dl>
    </>
  );
}
