import Link from "next/link";
import { MemberPassList } from "../../components/member-pass-list";
import { SocialAppShell } from "../../components/social-app-shell";

export default function ReceiptsPage() {
  return (
    <SocialAppShell
      active="receipts"
      kicker="Your passes"
      title="Everything you have unlocked, in one place."
      aside={<ReceiptsAside />}
    >
      <MemberPassList />
    </SocialAppShell>
  );
}

function ReceiptsAside() {
  return (
    <>
      <h2>Your access</h2>
      <p>Passes keep the rooms and drops you support easy to find.</p>
      <dl>
        <div><dt>Rooms</dt><dd><Link href="/rooms">Browse rooms</Link></dd></div>
        <div><dt>Creators</dt><dd><Link href="/profiles">Explore creators</Link></dd></div>
        <div><dt>Messages</dt><dd><Link href="/messages">Open inbox</Link></dd></div>
      </dl>
    </>
  );
}
