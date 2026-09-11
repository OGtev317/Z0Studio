import { CreatorProfileList } from "../../components/creator-profile-list";
import { SocialAppShell } from "../../components/social-app-shell";

export default function ProfilesPage() {
  return (
    <SocialAppShell active="profiles" kicker="Explore creators" title="Find the people making work you want to support.">
      <CreatorProfileList />
    </SocialAppShell>
  );
}
