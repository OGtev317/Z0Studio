"use client";

import { useEffect, useState } from "react";
import {
  createPublicFeedPost,
  parsePublicFeedResponse,
  parsePublicFeedHistory,
  updatePublicFeedHistory,
  type PublicFeedMode,
  type PublicFeedPost,
} from "../lib/public-feed";

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
    return "That belongs in an encrypted message, not the public feed.";
  }
  if (message === "PUBLIC_POST_TOO_LONG") {
    return "Public posts need to stay under 420 bytes.";
  }
  if (message === "PUBLIC_POST_RATE_LIMITED" || message === "PUBLIC_POST_SHARED_REJECTED") {
    return "The shared feed is busy. Wait a moment and try again.";
  }
  return "Public post rejected.";
}

export function PublicSocialFeed({ seedPosts }: { seedPosts: readonly SeedPost[] }) {
  const [posts, setPosts] = useState<PublicFeedPost[]>([]);
  const [feedMode, setFeedMode] = useState<PublicFeedMode>("local-fallback");
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState("Public posts only. Encrypted notes belong in Messages.");

  useEffect(() => {
    try {
      setPosts(parsePublicFeedHistory(localStorage.getItem(PUBLIC_FEED_KEY)));
    } catch {
      setNotice("Browser storage is unavailable. Public previews remain available.");
    }
    void refreshSharedFeed();
  }, []);

  async function refreshSharedFeed() {
    try {
      const response = await fetch("/api/feed", { headers: { accept: "application/json" } });
      if (!response.ok) return;
      const feed = parsePublicFeedResponse(await response.json());
      setFeedMode(feed.mode);
      if (feed.mode === "shared") {
        setPosts(feed.posts);
        setNotice("Shared public feed connected. Private notes still belong in Messages.");
      }
    } catch {
      setFeedMode("local-fallback");
    }
  }

  async function publishPost() {
    try {
      const post = createPublicFeedPost({
        author: "Zero Studio",
        handle: "zero-studio",
        title: title || "Public creator update",
        body,
        createdAt: Date.now(),
      });
      if (feedMode === "shared") {
        const response = await fetch("/api/feed", {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify(post),
        });
        if (!response.ok) throw new Error("PUBLIC_POST_SHARED_REJECTED");
        await refreshSharedFeed();
        setBody("");
        setTitle("");
        setNotice("Public update submitted to the shared feed.");
        return;
      }
      const nextPosts = updatePublicFeedHistory(posts, post);
      localStorage.setItem(PUBLIC_FEED_KEY, JSON.stringify(nextPosts));
      setPosts(nextPosts);
      setBody("");
      setTitle("");
      setNotice("Public update posted locally. No encrypted notes or private wallet data were included.");
    } catch (error) {
      setNotice(publicPostErrorMessage(error));
    }
  }

  return (
    <>
      <section className="public-feed-composer" aria-label="Public social feed composer">
        <div className="composer-avatar" aria-hidden="true">ZS</div>
        <div>
          <div className="feed-mode">
            <b>{feedMode === "shared" ? "Shared feed" : "Local preview feed"}</b>
            <span>{feedMode === "shared" ? "Backed by server-side public filtering" : "Seeded public posts plus browser-local updates"}</span>
          </div>
          <label>
            Public title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Creator update" />
          </label>
          <label>
            Public post
            <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Share a public preview. Do not paste keys, viewing keys, private notes, or memo plaintext." rows={3} />
          </label>
          <div className="composer-actions">
            <button type="button" onClick={publishPost} disabled={!body.trim()}>{feedMode === "shared" ? "Post publicly" : "Post local preview"}</button>
            <span role="status">{notice}</span>
          </div>
        </div>
      </section>

      <section className="social-feed" aria-label="Creator feed">
        {posts.map((post) => (
          <article className="feed-post public-update" key={`${post.handle}:${post.createdAt}`}>
            <div className="post-avatar" aria-hidden="true">{initials(post.author)}</div>
            <div>
              <header>
                <b>{post.author}</b>
                <span>@{post.handle}</span>
                <span>{relativeTime(post.createdAt)}</span>
              </header>
              <p className="post-visibility">{post.visibility}</p>
              <small className="post-source">{post.source === "shared" ? "Shared public feed" : "Browser-local public post"} · {post.status}</small>
              <h2>{post.title}</h2>
              <p>{post.body}</p>
            </div>
          </article>
        ))}
        {seedPosts.map((post) => (
          <article className="feed-post" key={`${post.handle}:${post.title}`}>
            <div className="post-avatar" aria-hidden="true">{initials(post.author)}</div>
            <div>
              <header>
                <b>{post.author}</b>
                <span>@{post.handle}</span>
                <span>{post.time}</span>
              </header>
              <p className="post-visibility">{post.visibility}</p>
              <small className="post-source">Seeded public post · published</small>
              <h2>{post.title}</h2>
              <p>{post.body}</p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
