"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  createPublicFeedPost,
  parsePublicFeedResponse,
  parsePublicFeedHistory,
  updatePublicFeedHistory,
  type PublicFeedPost,
} from "../lib/public-feed";
import { filterCreatorFeedItems, type FeedScope } from "../lib/feed-scope";
import { LOCAL_FOLLOWING_STORAGE_KEY, parseLocalFollowing } from "../lib/local-following";
import { creatorProfileHref } from "../lib/creator-navigation";

const PUBLIC_FEED_KEY = "zeerostream.public-feed.v1";

type SeedPost = {
  author: string;
  handle: string;
  createdAt: number;
  source: "seed";
  time: string;
  visibility: string;
  title: string;
  body: string;
};

function initials(value: string): string {
  return value.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function relativeTime(value: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - value) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function publicPostErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "PUBLIC_POST_PRIVATE_MATERIAL") {
    return "That belongs in a room or message, not the public feed.";
  }
  if (message === "PUBLIC_POST_TOO_LONG") {
    return "Public posts need to stay under 420 bytes.";
  }
  return "Public post rejected.";
}

export function PublicSocialFeed({ seedPosts }: { seedPosts: readonly SeedPost[] }) {
  const [posts, setPosts] = useState<PublicFeedPost[]>([]);
  const [feedScope, setFeedScope] = useState<FeedScope>("for-you");
  const [following, setFollowing] = useState<readonly string[]>([]);
  const [body, setBody] = useState("");
  const [sharedFeed, setSharedFeed] = useState(false);
  const [notice, setNotice] = useState("Loading your feed...");

  useEffect(() => {
    try {
      setPosts(parsePublicFeedHistory(localStorage.getItem(PUBLIC_FEED_KEY)));
      setFollowing(parseLocalFollowing(localStorage.getItem(LOCAL_FOLLOWING_STORAGE_KEY)));
    } catch {
      setNotice("Your browser cannot save drafts right now.");
    }
    void fetch("/api/feed", { credentials: "same-origin" })
      .then(async (response) => response.ok ? parsePublicFeedResponse(await response.json()) : null)
      .then((result) => {
        if (!result) {
          setNotice("Preview mode: posts you save here stay in this browser.");
          return;
        }
        setSharedFeed(result.mode === "shared");
        if (result.mode === "shared") {
          setPosts(result.posts);
          setNotice("Share what you are working on.");
        } else {
          setNotice("Preview mode: posts you save here stay in this browser.");
        }
      })
      .catch(() => setNotice("Preview mode: posts you save here stay in this browser."));
  }, []);

  async function savePost() {
    if (sharedFeed) {
      try {
        const response = await fetch("/api/feed", {
          method: "POST",
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ body }),
        });
        const result = await response.json() as { post?: PublicFeedPost; error?: string };
        if (response.status === 401) {
          setNotice("Join Z0Studio to publish a post.");
          return;
        }
        if (!response.ok || !result.post) {
          setNotice(result.error === "PUBLIC_POST_RATE_LIMITED" ? "Try another post in a minute." : publicPostErrorMessage(new Error(result.error)));
          return;
        }
        setPosts((current) => updatePublicFeedHistory(current, result.post!));
        setBody("");
        setNotice("Posted to your feed.");
        return;
      } catch {
        setNotice("We could not publish that right now.");
        return;
      }
    }
    try {
      const post = createPublicFeedPost({
        author: "You",
        handle: "local-member",
        title: "Community update",
        body,
        createdAt: Date.now(),
      });
      const nextPosts = updatePublicFeedHistory(posts, post);
      localStorage.setItem(PUBLIC_FEED_KEY, JSON.stringify(nextPosts));
      setPosts(nextPosts);
      setBody("");
      setNotice("Preview saved in this browser.");
    } catch (error) {
      setNotice(publicPostErrorMessage(error));
    }
  }

  const visiblePosts = filterCreatorFeedItems(posts, feedScope, following);
  const visibleSeedPosts = filterCreatorFeedItems(seedPosts, feedScope, following);
  const isFollowingEmpty = feedScope === "following" && visiblePosts.length === 0 && visibleSeedPosts.length === 0;

  return (
    <>
      <section className="social-tabs" role="tablist" aria-label="Home feed">
        <button type="button" role="tab" aria-selected={feedScope === "for-you"} onClick={() => setFeedScope("for-you")}>For you</button>
        <button type="button" role="tab" aria-selected={feedScope === "following"} onClick={() => setFeedScope("following")}>Following</button>
      </section>
      <section className="public-feed-composer" aria-label="Public social feed composer">
        <div className="composer-avatar" aria-hidden="true">Y</div>
        <div>
          <label>
            <span className="sr-only">Create a post</span>
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="What is happening?" rows={3} />
          </label>
          <div className="composer-actions">
            <span className="feed-mode">{sharedFeed ? "Public post" : "Preview mode"}</span>
            <button type="button" onClick={() => void savePost()} disabled={!body.trim()}>{sharedFeed ? "Post" : "Save preview"}</button>
            <span role="status">{notice}</span>
          </div>
        </div>
      </section>

      <section id="creator-feed" className="social-feed" aria-label="Creator feed">
        {visiblePosts.map((post) => (
          <article className="feed-post public-update" key={`${post.handle}:${post.createdAt}`}>
            <div className="post-avatar" aria-hidden="true">{initials(post.author)}</div>
            <div>
              <header>
                {post.handle === "local-member" ? <span className="post-author">{post.author}</span> : <Link className="post-author" href={creatorProfileHref(post.handle)}>{post.author}</Link>}
                {post.handle === "local-member" ? <span className="post-handle">Preview</span> : <Link className="post-handle" href={creatorProfileHref(post.handle)}>@{post.handle}</Link>}
                <span>{relativeTime(post.createdAt)}</span>
              </header>
              <p className="post-visibility">{post.visibility}</p>
              <small className="post-source">{post.source === "shared" ? "Shared post" : "Preview post"} · {post.status}</small>
              {post.title !== "Creator update" && post.title !== "Community update" ? <h2>{post.title}</h2> : null}
              <p>{post.body}</p>
            </div>
          </article>
        ))}
        {visibleSeedPosts.map((post) => (
          <article className="feed-post" key={`${post.handle}:${post.title}`}>
            <div className="post-avatar" aria-hidden="true">{initials(post.author)}</div>
            <div>
              <header>
                <Link className="post-author" href={creatorProfileHref(post.handle)}>{post.author}</Link>
                <Link className="post-handle" href={creatorProfileHref(post.handle)}>@{post.handle}</Link>
                <span>{post.time}</span>
              </header>
              <p className="post-visibility">{post.visibility}</p>
              <small className="post-source">Seeded public post · published</small>
              <h2>{post.title}</h2>
              <p>{post.body}</p>
            </div>
          </article>
        ))}
        {isFollowingEmpty ? <p className="feed-empty" role="status">Follow creators to see their updates here.</p> : null}
      </section>
    </>
  );
}
