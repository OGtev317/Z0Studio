"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { creatorProfiles } from "../lib/social-content";
import { LOCAL_FOLLOWING_STORAGE_KEY, parseLocalFollowing, toggleLocalFollowing } from "../lib/local-following";
import { findRoomForCreator } from "../lib/z0studio-rooms";

export function CreatorProfileList() {
  const [following, setFollowing] = useState<readonly string[]>([]);
  const [sharedFollows, setSharedFollows] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setFollowing(parseLocalFollowing(localStorage.getItem(LOCAL_FOLLOWING_STORAGE_KEY)));
    void fetch("/api/follows", { credentials: "same-origin" })
      .then(async (response) => response.ok ? response.json() as Promise<{ handles: string[] }> : null)
      .then((result) => {
        if (!result) return;
        setFollowing(result.handles);
        setSharedFollows(true);
      })
      .catch(() => undefined);
  }, []);

  async function toggleFollow(handle: string): Promise<void> {
    if (sharedFollows) {
      const nextFollowing = !following.includes(handle);
      try {
        const response = await fetch(`/api/follows/${encodeURIComponent(handle)}`, {
          method: nextFollowing ? "PUT" : "DELETE",
          credentials: "same-origin",
        });
        if (response.status === 401) {
          setNotice("Join Z0Studio to follow creators.");
          return;
        }
        if (!response.ok) throw new Error();
        setFollowing((current) => nextFollowing ? [...current, handle] : current.filter((entry) => entry !== handle));
        return;
      } catch {
        setNotice("We could not update that follow right now.");
        return;
      }
    }
    setFollowing((current) => {
      const next = toggleLocalFollowing(current, handle);
      localStorage.setItem(LOCAL_FOLLOWING_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <section className="profile-list" aria-label="Creator profiles">
      {creatorProfiles.map((profile) => {
        const isFollowing = following.includes(profile.handle);
        const room = findRoomForCreator(profile.handle);
        return (
          <article className="profile-card" id={profile.handle} key={profile.handle}>
            <div className="profile-cover" aria-hidden="true" />
            <div className="profile-body">
              <div className="profile-avatar" aria-hidden="true">{profile.name.split(" ").map((part) => part[0]).join("")}</div>
              <div className="profile-topline">
                <div>
                  <h2>{profile.name}</h2>
                  <p>@{profile.handle}</p>
                </div>
                <div className="profile-actions">
                  <button className="profile-follow" type="button" aria-pressed={isFollowing} onClick={() => void toggleFollow(profile.handle)}>
                    {isFollowing ? "Following" : "Follow"}
                  </button>
                  <Link className="button" href={room ? `/rooms#${room.id}` : "/rooms"}>View room</Link>
                </div>
              </div>
              <p>{profile.bio}</p>
              <div className="profile-stats" aria-label={`${profile.name} stats`}>
                <span><b>{profile.stats.posts}</b> posts</span>
                <span><b>{profile.stats.receipts}</b> passes</span>
                <span><b>{profile.stats.supporters}</b> supporters</span>
              </div>
              <div className="profile-tier">
                <b>{profile.tier}</b>
                <span>{profile.price} per month</span>
              </div>
            </div>
          </article>
        );
      })}
      {notice ? <p className="feed-empty" role="status">{notice}</p> : null}
    </section>
  );
}
