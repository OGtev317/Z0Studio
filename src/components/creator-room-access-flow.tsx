"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createCreatorRoomDraftPreview, type CreatorRoomDraftPreview } from "../lib/creator-room-draft";
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
import {
  creatorRoomTemplates,
  templateRequiresSeparateDropReceipt,
  z0StudioRooms,
  type RoomTemplateId,
} from "../lib/z0studio-rooms";
import { buildMemberRoomReadinessPanel } from "../lib/z0studio-room-readiness";
import { buildRoomShareTarget } from "../lib/z0studio-room-sharing";
import { evaluateZ0StudioRoomAccess } from "../lib/zeeroagent-room-access";

export function CreatorRoomAccessFlow({
  showRooms = true,
  showTemplates = false,
}: {
  showRooms?: boolean;
  showTemplates?: boolean;
}) {
  const now = Date.now();
  const [selectedTemplateId, setSelectedTemplateId] = useState<RoomTemplateId>(creatorRoomTemplates[0].id);
  const [roomName, setRoomName] = useState("");
  const [communityFocus, setCommunityFocus] = useState("");
  const [draftPreview, setDraftPreview] = useState<CreatorRoomDraftPreview | null>(null);
  const [draftError, setDraftError] = useState("");
  const [roomQuery, setRoomQuery] = useState("");
  const [roomFilter, setRoomFilter] = useState<RoomDiscoveryFilter>("all");
  const [roomSort, setRoomSort] = useState<RoomDiscoverySort>("recommended");
  const [following, setFollowing] = useState<readonly string[]>([]);
  const selectedTemplate = creatorRoomTemplates.find((template) => template.id === selectedTemplateId)
    ?? creatorRoomTemplates[0];
  const discovery = discoverRooms(z0StudioRooms, {
    query: roomQuery,
    filter: roomFilter,
    sort: roomSort,
    followingHandles: following,
  });
  const visibleRooms = discovery.rooms;

  useEffect(() => {
    setFollowing(parseLocalFollowing(localStorage.getItem(LOCAL_FOLLOWING_STORAGE_KEY)));
  }, []);

  function previewRoomDraft(): void {
    try {
      setDraftPreview(createCreatorRoomDraftPreview({
        template: selectedTemplate,
        roomName,
        communityFocus,
      }));
      setDraftError("");
    } catch (error) {
      setDraftPreview(null);
      setDraftError(error instanceof Error ? roomDraftErrorMessage(error.message) : "Add a room name and focus to continue.");
    }
  }

  return (
    <section className="room-access-flow" aria-labelledby="room-access-title">
      <div className="room-access-head">
        <div>
          <p className="eyebrow">Creator rooms</p>
          <h2 id="room-access-title">Find the room that brings you closer to the work.</h2>
          <p>
            Follow the public conversation, then join a room for member posts, direct access,
            and extras from the creators you support.
          </p>
        </div>
        <Link className="button" href="/profiles">Explore creators</Link>
      </div>

      {showRooms ? <>
        <section className="room-discovery-controls" aria-label="Find creator rooms">
          <label className="room-search-control">
            <span>Search</span>
            <input value={roomQuery} onChange={(event) => setRoomQuery(event.target.value)} placeholder="Search creators, rooms, drops" maxLength={80} />
          </label>
          <div className="room-discovery-filterbar" role="group" aria-label="Room filters">
            {roomDiscoveryFilters.map((filter) => <button type="button" aria-pressed={roomFilter === filter} key={filter} onClick={() => setRoomFilter(filter)}>{roomDiscoveryFilterLabels[filter]}</button>)}
          </div>
          <label className="room-sort-control">
            <span>Sort</span>
            <select value={roomSort} onChange={(event) => setRoomSort(event.target.value as RoomDiscoverySort)}>
              {roomDiscoverySorts.map((sort) => <option key={sort} value={sort}>{roomDiscoverySortLabels[sort]}</option>)}
            </select>
          </label>
          <p className="room-discovery-count" role="status">{discovery.visibleCount} of {discovery.totalCount} rooms</p>
        </section>
        {visibleRooms.length === 0 ? (
          <p className="feed-empty" role="status">
            {discovery.emptyReason} <button type="button" onClick={() => { setRoomQuery(""); setRoomFilter("all"); setRoomSort("recommended"); }}>Clear filters</button> <Link href="/profiles">Explore creators</Link>
          </p>
        ) : <div className="room-grid">
        {visibleRooms.map((room) => {
          const shareTarget = buildRoomShareTarget({ roomId: room.id, handle: room.handle, roomName: room.creator, creatorName: room.creator });
          const roomAccess = evaluateZ0StudioRoomAccess({
            viewerId: "visitor",
            room,
            pass: undefined,
            now,
          });
          const readiness = buildMemberRoomReadinessPanel({
            room,
            accessStatus: roomAccess.status,
          });
          return (
            <article className="room-card" id={shareTarget.roomId} key={room.id}>
              <div className="room-cover" aria-hidden="true" />
              <div className="room-card-body">
                <p className="eyebrow">{room.theme}</p>
                <h3>{room.creator}</h3>
                <small>@{room.handle} · {room.members} members · {room.entryPrice}</small>
                <div className="room-readiness-panel" aria-label={`${readiness.roomTitle} room readiness`}>
                  <div>
                    <span>{readiness.accessLabel}</span>
                    <b>{readiness.ownerLabel}</b>
                  </div>
                  <ul>
                    {readiness.contains.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                  <p>{readiness.nextAction}</p>
                </div>
                <div className={roomAccess.canViewRoom ? "room-feed unlocked" : "room-feed locked"}>
                  <b>{room.feedTitle}</b>
                  <p>{roomAccess.canViewRoom ? room.feedBody : roomAccess.message}</p>
                </div>
                <div className="drop-list">
                  {room.lockedDrops.map((drop) => {
                    const dropAccess = evaluateZ0StudioRoomAccess({
                      viewerId: "visitor",
                      room,
                      pass: undefined,
                      drop,
                      now,
                    });
                    return (
                      <div className={dropAccess.canViewDrop ? "drop unlocked" : "drop locked"} key={drop.id}>
                        <span>{dropAccess.canViewDrop ? "Ready" : "Members"}</span>
                        <b>{drop.title}</b>
                        <small>{drop.price}</small>
                      </div>
                    );
                  })}
                </div>
                <Link className="button secondary room-card-action" href={shareTarget.profileHref}>View creator</Link>
              </div>
            </article>
          );
        })}
        </div>}
      </> : null}

      {showTemplates ? (
        <div className="room-template-panel" aria-label="Creator room templates">
          {creatorRoomTemplates.map((template) => (
            <article key={template.id}>
              <div>
                <span>{template.defaultEntryPrice}</span>
                <h3>{template.name}</h3>
                <small>{template.audience}</small>
              </div>
              <dl>
                <div><dt>Membership</dt><dd>{template.defaultAccessTier}</dd></div>
                <div><dt>Access</dt><dd>{template.roomPolicy.passDurationDays} days</dd></div>
                <div><dt>Extras</dt><dd>{templateRequiresSeparateDropReceipt(template) ? "sold separately" : "included"}</dd></div>
              </dl>
              <div className="template-drop-list">
                {template.includedDrops.map((drop) => (
                  <span key={drop.id}>{drop.title}</span>
                ))}
              </div>
              <button
                className="template-choice"
                type="button"
                aria-pressed={selectedTemplate.id === template.id}
                onClick={() => {
                  setSelectedTemplateId(template.id);
                  setDraftPreview(null);
                  setDraftError("");
                }}
              >
                {selectedTemplate.id === template.id ? "Selected" : "Choose this room"}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      {showTemplates ? (
        <section className="template-selection" aria-labelledby="template-selection-title">
          <div>
            <p className="eyebrow">Your room</p>
            <h3 id="template-selection-title">{selectedTemplate.name}</h3>
            <p>{selectedTemplate.audience} · {selectedTemplate.defaultEntryPrice}</p>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); previewRoomDraft(); }}>
            <label>
              <span>Room name</span>
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Name your room" maxLength={48} />
            </label>
            <label>
              <span>Community focus</span>
              <input value={communityFocus} onChange={(event) => setCommunityFocus(event.target.value)} placeholder="What brings members together?" maxLength={120} />
            </label>
            <button type="submit">Preview room</button>
          </form>
          <p className="template-selection-status" role="status">{draftError || (draftPreview ? "Room preview ready." : "")}</p>
          {draftPreview ? (
            <div className="room-draft-preview">
              <div className="room-draft-avatar" aria-hidden="true">{draftPreview.roomName.slice(0, 2).toUpperCase()}</div>
              <div>
                <small>{draftPreview.templateName}</small>
                <h4>{draftPreview.roomName}</h4>
                <p>{draftPreview.communityFocus}</p>
              </div>
              <span>{draftPreview.accessTier}</span>
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function roomDraftErrorMessage(code: string): string {
  if (code === "ROOM_DRAFT_NAME_INVALID") return "Use a room name between 2 and 48 characters.";
  if (code === "ROOM_DRAFT_FOCUS_INVALID") return "Add a short community focus before previewing.";
  if (code === "ROOM_DRAFT_SENSITIVE_MATERIAL_REJECTED") return "Keep private account details out of your room profile.";
  return "Add a room name and focus to continue.";
}
