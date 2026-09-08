"use client";

import { useState } from "react";
import { openSocialThreads } from "../lib/z0studio-open-social";

type LocalThread = {
  id: string;
  title: string;
  body: string;
};

export function OpenSocialHub() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [threads, setThreads] = useState<LocalThread[]>([]);
  const [notice, setNotice] = useState("Open posts are public. Paid content belongs inside rooms.");

  function publishThread() {
    const cleanBody = body.replace(/\s+/g, " ").trim();
    const cleanTitle = title.replace(/\s+/g, " ").trim() || "Open creator post";
    if (!cleanBody) return;
    setThreads((current) => [{ id: crypto.randomUUID(), title: cleanTitle, body: cleanBody }, ...current].slice(0, 8));
    setTitle("");
    setBody("");
    setNotice("Public thread posted locally. Room-only material was not included.");
  }

  return (
    <section className="open-social-hub" aria-labelledby="open-social-title">
      <div className="open-social-head">
        <div>
          <p className="eyebrow">Open social layer</p>
          <h2 id="open-social-title">Creator-user communication stays open before the room gate.</h2>
          <p>
            Z0Studio can work like an open public timeline for discovery, replies, previews, and creator
            updates. Paid room access begins only when a user enters a creator room or unlocks a specific drop.
          </p>
        </div>
        <dl>
          <div><dt>Open</dt><dd>Posts, replies, follows</dd></div>
          <div><dt>Gated</dt><dd>Rooms and drops</dd></div>
          <div><dt>Policy</dt><dd>ZeeroAgent checks</dd></div>
        </dl>
      </div>

      <div className="open-social-compose">
        <label>
          Public title
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ask or announce something" />
        </label>
        <label>
          Public post
          <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Open timeline post. Keep paid files, private notes, wallet data, and member-only content out." rows={3} />
        </label>
        <div className="composer-actions">
          <button type="button" onClick={publishThread} disabled={!body.trim()}>Post open thread</button>
          <span role="status">{notice}</span>
        </div>
      </div>

      <div className="open-thread-list">
        {threads.map((thread) => (
          <article key={thread.id}>
            <span>Local</span>
            <h3>{thread.title}</h3>
            <p>{thread.body}</p>
            <small>Replies ready locally · room upsell disabled</small>
          </article>
        ))}
        {openSocialThreads.map((thread) => (
          <article key={thread.id}>
            <span>{thread.audience}</span>
            <h3>{thread.title}</h3>
            <p>{thread.body}</p>
            <small>@{thread.handle} · {thread.replies} replies · {thread.boosts} boosts</small>
          </article>
        ))}
      </div>
    </section>
  );
}
