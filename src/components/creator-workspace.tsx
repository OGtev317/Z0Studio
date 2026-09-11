"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { creatorRoomTemplates, type RoomTemplateId } from "../lib/z0studio-rooms";
import {
  buildRoomSetupChecklist,
  defaultRoomCustomization,
  roomAccentColors,
  roomCoverStyles,
  type RoomCustomization,
} from "../lib/z0studio-room-customization";
import { buildRoomShareTarget } from "../lib/z0studio-room-sharing";

type Account = { displayName: string; handle: string; role: "member" | "creator" };
type Profile = { displayName: string; bio: string; role: "member" | "creator" };
type Room = { id: string; name: string; focus: string; template_id: string; entry_label: string; status: "draft" | "published" | "archived"; pending_members: number; active_members: number; customization?: RoomCustomization };
type CreatedRoom = { id: string; name: string; focus: string; templateId: string; entryLabel: string; status: "draft" | "published" | "archived"; customization?: RoomCustomization; createdAt: number; updatedAt: number };
type UpdatedRoom = { id: string; name: string; focus: string; entryLabel: string; status: "draft" | "published" | "archived"; customization: RoomCustomization };
type Member = { id: string; display_name: string; handle: string; state: "pending" | "active" | "blocked" | "removed" };
type Report = { id: string; room_id: string | null; subject_type: string; subject_id: string; reason: string; status: string };

function errorMessage(value: unknown): string {
  const error = value as { error?: string };
  if (error.error === "AUTH_REQUIRED") return "Join Z0Studio to manage your creator space.";
  if (error.error === "CREATOR_ACCOUNT_REQUIRED") return "Finish your creator profile before creating a room.";
  if (error.error === "ROOM_NAME_INVALID") return "Give your room a name between 2 and 48 characters.";
  if (error.error === "ROOM_FOCUS_INVALID") return "Add a short focus for your community.";
  if (error.error === "ROOM_ACCENT_INVALID" || error.error === "ROOM_COVER_INVALID") return "Choose a room style from the list.";
  if (error.error === "ROOM_WELCOME_INVALID") return "Keep the welcome note short and public.";
  if (error.error === "ROOM_CADENCE_INVALID") return "Keep the posting rhythm short and public.";
  if (error.error === "ROOM_RULES_INVALID") return "Keep room rules short and public.";
  return "We could not save that right now.";
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw body;
  return body;
}

function labelFromOption(value: string): string {
  return value.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function createdRoomToCreatorRoom(room: CreatedRoom): Room {
  return {
    id: room.id,
    name: room.name,
    focus: room.focus,
    template_id: room.templateId,
    entry_label: room.entryLabel,
    status: room.status,
    pending_members: 0,
    active_members: 0,
    customization: room.customization ?? defaultRoomCustomization,
  };
}

export function CreatorWorkspace() {
  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [notice, setNotice] = useState("Sign in to create and manage your community.");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await api<{ account: Account | null }>("/api/auth/me");
      setAccount(me.account);
      if (!me.account) return;
      const creatorProfile = await api<{ profile: Profile | null }>("/api/creator/profile");
      setProfile(creatorProfile.profile);
      if (creatorProfile.profile?.role !== "creator") return;
      const [creatorRooms, creatorReports] = await Promise.all([
        api<{ rooms: Room[] }>("/api/creator/rooms"),
        api<{ reports: Report[] }>("/api/creator/reports"),
      ]);
      const normalizedRooms = creatorRooms.rooms.map((room) => ({ ...room, customization: room.customization ?? defaultRoomCustomization }));
      setRooms(normalizedRooms);
      setReports(creatorReports.reports);
      setSelectedRoomId((current) => current && normalizedRooms.some((room) => room.id === current) ? current : normalizedRooms[0]?.id || "");
      setNotice(normalizedRooms.length ? "Your creator space is ready." : "Create your first room when you are ready.");
    } catch (error) {
      setNotice(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const listener = () => void refresh();
    window.addEventListener("z0studio:account-changed", listener);
    return () => window.removeEventListener("z0studio:account-changed", listener);
  }, [refresh]);

  useEffect(() => {
    if (!selectedRoomId || profile?.role !== "creator") {
      setMembers([]);
      return;
    }
    void api<{ members: Member[] }>(`/api/creator/rooms/${selectedRoomId}/members`)
      .then((result) => setMembers(result.members))
      .catch(() => setMembers([]));
  }, [profile?.role, selectedRoomId]);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>, becomeCreator: boolean) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ profile: Profile }>("/api/creator/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName: form.get("displayName"), bio: form.get("bio"), role: becomeCreator ? "creator" : profile?.role }),
      });
      setProfile(result.profile);
      setAccount((current) => current ? { ...current, displayName: result.profile.displayName, role: result.profile.role } : current);
      setNotice(becomeCreator ? "Your creator space is ready." : "Creator profile saved.");
      await refresh();
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ room: CreatedRoom }>("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), focus: form.get("focus"), templateId: form.get("templateId"), entryLabel: "Request to join" }),
      });
      const room = createdRoomToCreatorRoom(result.room);
      event.currentTarget.reset();
      setRooms((current) => [room, ...current]);
      setSelectedRoomId(room.id);
      setNotice("Room created. Invite members when you are ready.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateRoomSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const roomToUpdate = rooms.find((room) => room.id === selectedRoomId);
    if (!roomToUpdate) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await api<{ room: UpdatedRoom }>(`/api/creator/rooms/${roomToUpdate.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.get("settingsName"),
          focus: form.get("settingsFocus"),
          entryLabel: form.get("entryLabel"),
          status: form.get("status"),
          customization: {
            accentColor: form.get("accentColor"),
            coverStyle: form.get("coverStyle"),
            welcomeNote: form.get("welcomeNote"),
            postingCadence: form.get("postingCadence"),
            roomRules: form.get("roomRules"),
          },
        }),
      });
      setRooms((current) => current.map((room) => room.id === roomToUpdate.id ? {
        ...room,
        name: result.room.name,
        focus: result.room.focus,
        entry_label: result.room.entryLabel,
        status: result.room.status,
        customization: result.room.customization,
      } : room));
      setNotice("Room settings saved.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(memberId: string, action: "approve" | "block" | "remove") {
    if (!selectedRoomId) return;
    setBusy(true);
    try {
      await api(`/api/creator/rooms/${selectedRoomId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setMembers((current) => current.map((member) => member.id === memberId ? { ...member, state: action === "approve" ? "active" : action === "block" ? "blocked" : "removed" } : member));
      setRooms((current) => current.map((room) => room.id !== selectedRoomId ? room : {
        ...room,
        pending_members: Math.max(0, room.pending_members - 1),
        active_members: action === "approve" ? room.active_members + 1 : room.active_members,
      }));
      setNotice(action === "approve" ? "Member approved." : action === "block" ? "Member blocked." : "Member removed.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function createRoomPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRoomId) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api(`/api/rooms/${selectedRoomId}/posts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: form.get("body") }),
      });
      event.currentTarget.reset();
      setNotice("Room post published.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function updateReport(reportId: string, action: "review" | "resolve") {
    setBusy(true);
    try {
      const result = await api<{ status: string }>(`/api/creator/reports/${reportId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setReports((current) => current.map((report) => report.id === reportId ? { ...report, status: result.status } : report));
      setNotice(action === "resolve" ? "Report resolved." : "Report marked for review.");
    } catch (error) {
      setNotice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copyText(value: string, message: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(message);
    } catch {
      setNotice(value);
    }
  }

  function roomShareTarget(room: Room, origin?: string) {
    return buildRoomShareTarget({
      roomId: room.id,
      handle: account?.handle ?? "",
      roomName: room.name,
      creatorName: profile?.displayName ?? account?.displayName ?? "Z0Studio",
      origin,
    });
  }

  async function copyRoomLink(room: Room): Promise<void> {
    const target = roomShareTarget(room, window.location.origin);
    await copyText(target.roomUrl, "Room link copied.");
  }

  async function copyRoomPost(room: Room): Promise<void> {
    const target = roomShareTarget(room, window.location.origin);
    await copyText(target.copyText, "Post text copied.");
  }

  async function shareRoom(room: Room): Promise<void> {
    const target = roomShareTarget(room, window.location.origin);
    if (navigator.share) {
      try {
        await navigator.share({ title: target.title, text: target.postText, url: target.roomUrl });
        setNotice("Room share opened.");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyText(target.copyText, "Share text copied.");
  }

  if (!account) {
    return <section className="creator-workspace" aria-labelledby="creator-workspace-title"><p className="eyebrow">Your creator space</p><h2 id="creator-workspace-title">Start with an account, then make the room your own.</h2><p className="workspace-intro">Your profile, rooms, member approvals, and moderation tools will all live here.</p><p className="workspace-notice" role="status">{notice}</p></section>;
  }

  const activeRoom = rooms.find((room) => room.id === selectedRoomId);
  const isCreator = profile?.role === "creator";
  const activeCustomization = activeRoom?.customization ?? defaultRoomCustomization;
  const activeShareTarget = activeRoom ? roomShareTarget(activeRoom) : null;
  const activeRoomSetup = activeRoom ? buildRoomSetupChecklist({
    name: activeRoom.name,
    focus: activeRoom.focus,
    entryLabel: activeRoom.entry_label,
    status: activeRoom.status,
    customization: activeCustomization,
  }) : null;
  return (
    <section className="creator-workspace" aria-labelledby="creator-workspace-title">
      <div className="creator-workspace-head">
        <div><p className="eyebrow">Your creator space</p><h2 id="creator-workspace-title">@{account.handle}</h2></div>
        <p className="workspace-notice" role="status">{notice}</p>
      </div>
      <form className="creator-profile-form" onSubmit={(event) => void saveProfile(event, !isCreator)}>
        <label>Display name<input name="displayName" defaultValue={profile?.displayName ?? account.displayName} maxLength={64} required /></label>
        <label>About your work<textarea name="bio" defaultValue={profile?.bio ?? ""} maxLength={320} required placeholder="Tell members what they can expect." /></label>
        <button type="submit" disabled={busy}>{isCreator ? "Save profile" : "Become a creator"}</button>
      </form>
      {isCreator ? <>
        <form className="creator-room-form" onSubmit={(event) => void createRoom(event)}>
          <div><p className="eyebrow">New room</p><h3>Give your community a place to gather.</h3></div>
          <label>Room name<input name="name" maxLength={48} required placeholder="Your room name" /></label>
          <label>Community focus<textarea name="focus" maxLength={240} required placeholder="What are members here for?" /></label>
          <label>Room format<select name="templateId" defaultValue={creatorRoomTemplates[0].id}>{creatorRoomTemplates.map((template) => <option key={template.id} value={template.id as RoomTemplateId}>{template.name}</option>)}</select></label>
          <button type="submit" disabled={busy}>Create room</button>
        </form>
        <div className="creator-operations">
          <section aria-labelledby="your-rooms-title"><h3 id="your-rooms-title">Your rooms</h3>{rooms.length === 0 ? <p className="workspace-empty">Your first room will show up here.</p> : <div className="creator-room-list">{rooms.map((room) => <button className={room.id === selectedRoomId ? "active" : ""} type="button" key={room.id} onClick={() => setSelectedRoomId(room.id)}><b>{room.name}</b><span>{room.active_members} members · {room.pending_members} waiting</span></button>)}</div>}</section>
          <section aria-labelledby="member-requests-title"><h3 id="member-requests-title">Member requests</h3>{!activeRoom ? <p className="workspace-empty">Choose a room to review requests.</p> : members.filter((member) => member.state === "pending").length === 0 ? <p className="workspace-empty">No member requests for {activeRoom.name}.</p> : <div className="member-request-list">{members.filter((member) => member.state === "pending").map((member) => <article key={member.id}><div><b>{member.display_name}</b><span>@{member.handle}</span></div><div><button type="button" onClick={() => void updateMember(member.id, "approve")} disabled={busy}>Approve</button><button className="secondary" type="button" onClick={() => void updateMember(member.id, "block")} disabled={busy}>Block</button></div></article>)}</div>}</section>
        </div>
        {activeRoom ? <form className="room-settings-form" key={activeRoom.id} onSubmit={(event) => void updateRoomSettings(event)}>
          <div className="room-setup-column">
            <div className={`room-live-preview room-style-preview room-accent-${activeCustomization.accentColor} room-cover-${activeCustomization.coverStyle}`} aria-label={`Preview for ${activeRoom.name}`}>
              <p className="eyebrow">Preview</p>
              <span>@{account.handle}</span>
              <h3>{activeRoom.name}</h3>
              <p>{activeCustomization.welcomeNote}</p>
              <small>{activeCustomization.postingCadence}</small>
            </div>
            {activeRoomSetup ? <section className="room-setup-checklist" aria-labelledby={`room-setup-${activeRoom.id}`}>
              <div className="room-setup-meter">
                <div><p className="eyebrow">Room setup</p><h3 id={`room-setup-${activeRoom.id}`}>{activeRoomSetup.nextAction}</h3></div>
                <strong>{activeRoomSetup.completionPercent}%</strong>
              </div>
              <div className="room-setup-track" aria-hidden="true"><span style={{ width: `${activeRoomSetup.completionPercent}%` }} /></div>
              <ol>{activeRoomSetup.steps.map((step) => <li className={step.completed ? "complete" : ""} key={step.id}><span>{step.completed ? "Done" : "Next"}</span><b>{step.label}</b></li>)}</ol>
            </section> : null}
            {activeShareTarget ? <section className="room-share-panel" aria-labelledby={`room-share-${activeRoom.id}`}>
              <div><p className="eyebrow">Share room</p><h3 id={`room-share-${activeRoom.id}`}>Send people straight to this room.</h3></div>
              <p>{activeShareTarget.copyText}</p>
              <div className="room-share-actions">
                <Link className="button secondary" href={activeShareTarget.roomHref}>Open room</Link>
                <button className="secondary" type="button" onClick={() => void copyRoomLink(activeRoom)}>Copy link</button>
                <button type="button" onClick={() => void shareRoom(activeRoom)}>Share</button>
                <button className="secondary" type="button" onClick={() => void copyRoomPost(activeRoom)}>Copy post</button>
              </div>
            </section> : null}
          </div>
          <div className="room-settings-fields">
            <div><p className="eyebrow">Room settings</p><h3>{activeRoom.name}</h3></div>
            <label>Room name<input name="settingsName" defaultValue={activeRoom.name} maxLength={48} required /></label>
            <label>Community focus<textarea name="settingsFocus" defaultValue={activeRoom.focus} maxLength={240} required /></label>
            <label>Join button<input name="entryLabel" defaultValue={activeRoom.entry_label} maxLength={32} required /></label>
            <div className="room-customization-grid">
              <label>Accent<select name="accentColor" defaultValue={activeCustomization.accentColor}>{roomAccentColors.map((accent) => <option key={accent} value={accent}>{labelFromOption(accent)}</option>)}</select></label>
              <label>Cover<select name="coverStyle" defaultValue={activeCustomization.coverStyle}>{roomCoverStyles.map((style) => <option key={style} value={style}>{labelFromOption(style)}</option>)}</select></label>
              <label>Status<select name="status" defaultValue={activeRoom.status}><option value="published">Published</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            </div>
            <label>Welcome note<textarea name="welcomeNote" defaultValue={activeCustomization.welcomeNote} maxLength={180} required /></label>
            <label>Posting rhythm<input name="postingCadence" defaultValue={activeCustomization.postingCadence} maxLength={80} required /></label>
            <label>Room rules<textarea name="roomRules" defaultValue={activeCustomization.roomRules} maxLength={240} required /></label>
            <button type="submit" disabled={busy}>Save room</button>
          </div>
        </form> : null}
        <form className="room-post-form" onSubmit={(event) => void createRoomPost(event)}>
          <label>Post to {activeRoom?.name ?? "your room"}<textarea name="body" maxLength={2000} required disabled={!activeRoom} placeholder="Share an update with your members." /></label>
          <button type="submit" disabled={busy || !activeRoom}>Post to room</button>
        </form>
        <section className="creator-report-queue" aria-labelledby="report-queue-title"><h3 id="report-queue-title">Report queue</h3>{reports.length === 0 ? <p className="workspace-empty">No reports from your rooms.</p> : reports.map((report) => <article key={report.id}><div><b>{report.subject_type} report</b><p>{report.reason}</p><span>{report.status}</span></div><div>{report.status === "open" ? <button className="secondary" type="button" onClick={() => void updateReport(report.id, "review")} disabled={busy}>Review</button> : null}{report.status !== "resolved" ? <button type="button" onClick={() => void updateReport(report.id, "resolve")} disabled={busy}>Resolve</button> : null}</div></article>)}</section>
      </> : null}
    </section>
  );
}
