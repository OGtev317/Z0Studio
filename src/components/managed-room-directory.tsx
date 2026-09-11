"use client";

import { useEffect, useState } from "react";
import { LOCAL_FOLLOWING_STORAGE_KEY, parseLocalFollowing } from "../lib/local-following";
import {
  discoverRooms,
  roomDiscoveryFilterLabels,
  roomDiscoveryFilters,
  roomDiscoverySortLabels,
  roomDiscoverySorts,
  type RoomDiscoveryFilter,
  type RoomDiscoverySort,
} from "../lib/z0studio-room-discovery";
import { defaultRoomCustomization, type RoomCustomization } from "../lib/z0studio-room-customization";
import { buildMemberRoomReadinessPanel } from "../lib/z0studio-room-readiness";
import { buildRoomShareTarget } from "../lib/z0studio-room-sharing";

type Account = { id: string; role: "member" | "creator" };
type Room = { id: string; creatorId: string; creator: string; handle: string; name: string; focus: string; entryLabel: string; members: number; templateId?: string; createdAt?: number; updatedAt?: number; customization?: RoomCustomization };
type Membership = { state: "none" | "pending" | "active" | "blocked" | "removed"; canEnter: boolean };
type RoomPost = { id: string; body: string; created_at: number; author: string; handle: string };

function requestText(error: unknown): string {
  const code = (error as { error?: string }).error;
  if (code === "AUTH_REQUIRED") return "Join Z0Studio to request room access.";
  if (code === "ACCESS_NOT_AVAILABLE") return "This room is not available to this account.";
  return "We could not update room access right now.";
}

export function ManagedRoomDirectory() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [account, setAccount] = useState<Account | null>(null);
  const [memberships, setMemberships] = useState<Record<string, Membership>>({});
  const [openRoomId, setOpenRoomId] = useState("");
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [reportingRoomId, setReportingRoomId] = useState("");
  const [notice, setNotice] = useState("");
  const [followingHandles, setFollowingHandles] = useState<readonly string[]>([]);
  const [roomQuery, setRoomQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<RoomDiscoveryFilter>("all");
  const [roomSort, setRoomSort] = useState<RoomDiscoverySort>("recommended");

  async function loadRooms() {
    try {
      setFollowingHandles(parseLocalFollowing(localStorage.getItem(LOCAL_FOLLOWING_STORAGE_KEY)));
      const [roomResponse, accountResponse] = await Promise.all([
        fetch("/api/rooms", { credentials: "same-origin" }),
        fetch("/api/auth/me", { credentials: "same-origin" }),
      ]);
      if (!roomResponse.ok) return;
      const roomData = await roomResponse.json() as { rooms: Room[] };
      const accountData = accountResponse.ok ? await accountResponse.json() as { account: Account | null } : { account: null };
      setRooms(roomData.rooms);
      setAccount(accountData.account);
      if (accountData.account) {
        void fetch("/api/follows", { credentials: "same-origin" })
          .then(async (response) => response.ok ? response.json() as Promise<{ handles: string[] }> : null)
          .then((result) => {
            if (result) setFollowingHandles(result.handles);
          })
          .catch(() => undefined);
      }
      if (accountData.account) {
        const pairs = await Promise.all(roomData.rooms.map(async (room) => {
          const response = await fetch(`/api/rooms/${room.id}/access-requests`, { credentials: "same-origin" });
          return [room.id, response.ok ? await response.json() as Membership : { state: "none", canEnter: false } as Membership] as const;
        }));
        setMemberships(Object.fromEntries(pairs));
      }
    } catch {
      setNotice("");
    }
  }

  useEffect(() => {
    void loadRooms();
    const listener = () => void loadRooms();
    window.addEventListener("z0studio:account-changed", listener);
    return () => window.removeEventListener("z0studio:account-changed", listener);
  }, []);

  async function requestAccess(roomId: string) {
    try {
      const response = await fetch(`/api/rooms/${roomId}/access-requests`, { method: "POST", credentials: "same-origin" });
      const result = await response.json() as Membership & { error?: string };
      if (!response.ok) {
        setNotice(requestText(result));
        return;
      }
      setMemberships((current) => ({ ...current, [roomId]: result }));
      setNotice(result.canEnter ? "You are already in this room." : "Access request sent to the creator.");
    } catch {
      setNotice("We could not send that request right now.");
    }
  }

  async function openRoom(roomId: string) {
    try {
      const response = await fetch(`/api/rooms/${roomId}/posts`, { credentials: "same-origin" });
      const result = await response.json() as { posts?: RoomPost[]; error?: string };
      if (!response.ok) {
        setNotice(result.error === "ROOM_ACCESS_REQUIRED" ? "Request access before opening this room." : requestText(result));
        return;
      }
      setOpenRoomId(roomId);
      setPosts(result.posts ?? []);
      setNotice("");
    } catch {
      setNotice("We could not open this room right now.");
    }
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>, roomId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectType: "room", subjectId: roomId, roomId, reason: form.get("reason") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setNotice(requestText(result));
        return;
      }
      setReportingRoomId("");
      setNotice("Report sent for creator review.");
    } catch {
      setNotice("We could not send that report right now.");
    }
  }

  if (rooms.length === 0) return null;
  const discovery = discoverRooms(rooms, {
    query: roomQuery,
    filter: roomFilter,
    sort: roomSort,
    followingHandles,
  });
  const visibleRooms = discovery.rooms;
  return (
    <section className="managed-room-directory" aria-labelledby="managed-rooms-title">
      <div className="managed-room-head"><div><p className="eyebrow">Community rooms</p><h2 id="managed-rooms-title">Join creators building on Z0Studio.</h2></div>{notice ? <p role="status">{notice}</p> : null}</div>
      <section className="room-discovery-controls" aria-label="Find community rooms">
        <label className="room-search-control">
          <span>Search</span>
          <input value={roomQuery} onChange={(event) => setRoomQuery(event.target.value)} placeholder="Search creators, rooms, drops" maxLength={80} />
        </label>
        <div className="room-discovery-filterbar" role="tablist" aria-label="Room filters">
          {roomDiscoveryFilters.map((filter) => <button type="button" role="tab" aria-selected={roomFilter === filter} key={filter} onClick={() => setRoomFilter(filter)}>{roomDiscoveryFilterLabels[filter]}</button>)}
        </div>
        <label className="room-sort-control">
          <span>Sort</span>
          <select value={roomSort} onChange={(event) => setRoomSort(event.target.value as RoomDiscoverySort)}>
            {roomDiscoverySorts.map((sort) => <option key={sort} value={sort}>{roomDiscoverySortLabels[sort]}</option>)}
          </select>
        </label>
        <p className="room-discovery-count" role="status">{discovery.visibleCount} of {discovery.totalCount} rooms</p>
      </section>
      {visibleRooms.length === 0 ? <p className="feed-empty" role="status">{discovery.emptyReason} <button type="button" onClick={() => { setRoomQuery(""); setRoomFilter("all"); setRoomSort("recommended"); }}>Clear filters</button></p> : <div className="managed-room-list">{visibleRooms.map((room) => {
        const membership = memberships[room.id];
        const customization = room.customization ?? defaultRoomCustomization;
        const shareTarget = buildRoomShareTarget({ roomId: room.id, handle: room.handle, roomName: room.name, creatorName: room.creator });
        const ownsRoom = account?.id === room.creatorId;
        const open = room.id === openRoomId;
        const readiness = buildMemberRoomReadinessPanel({
          room,
          memberState: ownsRoom ? "owned" : membership?.state ?? "none",
          ownsRoom,
        });
        return <article className={`managed-room-card room-accent-${customization.accentColor} room-cover-${customization.coverStyle}`} id={shareTarget.roomId} key={room.id}>
          <div className="managed-room-cover" aria-hidden="true" />
          <div>
            <p className="eyebrow">@{room.handle}</p><h3>{room.name}</h3><p>{room.focus}</p><p className="managed-room-welcome">{customization.welcomeNote}</p><small>{room.members} members · {customization.postingCadence}</small>
            <div className="room-readiness-panel managed-room-readiness" aria-label={`${readiness.roomTitle} room readiness`}>
              <div>
                <span>{readiness.accessLabel}</span>
                <b>{readiness.ownerLabel}</b>
              </div>
              <ul>
                {readiness.contains.map((item) => <li key={item}>{item}</li>)}
              </ul>
              <p>{readiness.nextAction}</p>
            </div>
          </div>
          <div className="managed-room-actions">
            <a className="button secondary" href={shareTarget.profileHref}>Creator</a>
            {ownsRoom || membership?.canEnter ? <button type="button" onClick={() => void openRoom(room.id)}>{open ? "Refresh room" : "Open room"}</button>
              : membership?.state === "pending" ? <span className="managed-room-state">Request sent</span>
                : membership?.state === "blocked" ? <span className="managed-room-state">Access unavailable</span>
                : <button type="button" onClick={() => void requestAccess(room.id)}>{room.entryLabel}</button>}
            <button className="secondary" type="button" onClick={() => setReportingRoomId(reportingRoomId === room.id ? "" : room.id)}>Report</button>
          </div>
          {reportingRoomId === room.id ? <form className="room-report-form" onSubmit={(event) => void submitReport(event, room.id)}><label><span className="sr-only">Reason for report</span><input name="reason" required maxLength={1000} placeholder="Tell the creator what happened" /></label><button type="submit">Send report</button></form> : null}
          {open ? <div className="managed-room-posts"><p className="managed-room-rules">{customization.roomRules}</p>{posts.length === 0 ? <p>No posts yet. Check back soon.</p> : posts.map((post) => <article key={post.id}><b>{post.author}</b><span>@{post.handle}</span><p>{post.body}</p></article>)}</div> : null}
        </article>;
      })}</div>}
    </section>
  );
}
