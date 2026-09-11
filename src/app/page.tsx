import Link from "next/link";
import { PublicSocialFeed } from "../components/public-social-feed";
import { SocialAppShell } from "../components/social-app-shell";
import { socialPosts } from "../lib/social-content";

export default function Home() {
  return (
    <SocialAppShell
      active="home"
      kicker="Your home feed"
      title="The place for creators and the people who back them."
      aside={<HomeAside />}
    >
      <section className="home-welcome" aria-label="Welcome to Z0Studio">
        <div className="composer-avatar" aria-hidden="true">ZS</div>
        <div>
          <h2>Follow the work. Join the room when you want more.</h2>
          <p>Everything starts in the feed. Discover creators, keep up with their posts, and unlock member spaces on your terms.</p>
          <div className="composer-actions">
            <Link className="button" href="/profiles">Explore creators</Link>
            <Link href="/rooms">Browse rooms</Link>
          </div>
        </div>
      </section>
      <PublicSocialFeed seedPosts={socialPosts} />
    </SocialAppShell>
  );
}

function HomeAside() {
  return (
    <>
      <h2>Make yourself at home</h2>
      <p>Every creator has an open feed. Rooms bring the closer community together.</p>
      <dl>
        <div><dt>Explore</dt><dd>Find your people</dd></div>
        <div><dt>Follow</dt><dd>Stay in the loop</dd></div>
        <div><dt>Join</dt><dd>Get closer access</dd></div>
      </dl>
      <Link className="context-link" href="/pro">Build your creator space</Link>
    </>
  );
}
