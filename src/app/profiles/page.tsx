import Link from "next/link";
import { SocialAppShell } from "../../components/social-app-shell";
import { creatorProfiles } from "../../lib/social-content";

export default function ProfilesPage() {
  return (
    <SocialAppShell active="profiles" kicker="Creator profiles" title="Creators can publish paid feeds with a private checkout lane.">
      <section className="profile-list" aria-label="Creator profiles">
        {creatorProfiles.map((profile) => (
          <article className="profile-card" key={profile.handle}>
            <div className="profile-cover" aria-hidden="true" />
            <div className="profile-body">
              <div className="profile-avatar" aria-hidden="true">{profile.name.split(" ").map((part) => part[0]).join("")}</div>
              <div className="profile-topline">
                <div>
                  <h2>{profile.name}</h2>
                  <p>@{profile.handle}</p>
                </div>
                <Link className="button" href="/#pay">Subscribe</Link>
              </div>
              <p>{profile.bio}</p>
              <div className="profile-stats" aria-label={`${profile.name} stats`}>
                <span><b>{profile.stats.posts}</b> posts</span>
                <span><b>{profile.stats.receipts}</b> receipts</span>
                <span><b>{profile.stats.supporters}</b> supporters</span>
              </div>
              <div className="profile-tier">
                <b>{profile.tier}</b>
                <span>{profile.price} private checkout</span>
              </div>
            </div>
          </article>
        ))}
      </section>
    </SocialAppShell>
  );
}
