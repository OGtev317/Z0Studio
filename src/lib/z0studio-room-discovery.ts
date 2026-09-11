import type { RoomCustomization } from "./z0studio-room-customization";

export const roomDiscoveryFilters = [
  "all",
  "following",
  "new",
  "active",
  "free-preview",
  "member-rooms",
  "drop-rooms",
] as const;

export const roomDiscoverySorts = [
  "recommended",
  "newest",
  "most-members",
  "creator",
] as const;

export type RoomDiscoveryFilter = typeof roomDiscoveryFilters[number];
export type RoomDiscoverySort = typeof roomDiscoverySorts[number];

export type DiscoverableRoom = {
  id: string;
  name?: string;
  creator?: string;
  handle: string;
  focus?: string;
  theme?: string;
  entryLabel?: string;
  entryPrice?: string;
  members?: number;
  templateId?: string;
  template_id?: string;
  createdAt?: number;
  created_at?: number;
  updatedAt?: number;
  updated_at?: number;
  customization?: Partial<RoomCustomization>;
  lockedDrops?: readonly { access?: string; price?: string; title?: string }[];
};

export type RoomDiscoveryOptions = {
  query?: string;
  filter?: RoomDiscoveryFilter;
  sort?: RoomDiscoverySort;
  followingHandles?: readonly string[];
  now?: number;
  newWindowMs?: number;
};

export type RoomDiscoveryResult<Room extends DiscoverableRoom> = {
  rooms: Room[];
  totalCount: number;
  visibleCount: number;
  query: string;
  filter: RoomDiscoveryFilter;
  sort: RoomDiscoverySort;
  emptyReason: string | null;
};

export const roomDiscoveryFilterLabels: Record<RoomDiscoveryFilter, string> = {
  all: "All",
  following: "Following",
  new: "New",
  active: "Active",
  "free-preview": "Free preview",
  "member-rooms": "Member rooms",
  "drop-rooms": "Drop rooms",
};

export const roomDiscoverySortLabels: Record<RoomDiscoverySort, string> = {
  recommended: "Recommended",
  newest: "Newest",
  "most-members": "Most members",
  creator: "Creator A-Z",
};

const DEFAULT_NEW_WINDOW_MS = 1000 * 60 * 60 * 24 * 14;

function cleanQuery(value: string | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 80).toLowerCase();
}

function validDiscoveryFilter(value: string | undefined): RoomDiscoveryFilter {
  return roomDiscoveryFilters.includes(value as RoomDiscoveryFilter) ? value as RoomDiscoveryFilter : "all";
}

function validDiscoverySort(value: string | undefined): RoomDiscoverySort {
  return roomDiscoverySorts.includes(value as RoomDiscoverySort) ? value as RoomDiscoverySort : "recommended";
}

function normalizedHandle(value: string): string | null {
  const handle = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(handle) ? handle : null;
}

function roomTemplateId(room: DiscoverableRoom): string {
  return String(room.templateId ?? room.template_id ?? "");
}

function roomTitle(room: DiscoverableRoom): string {
  return String(room.name ?? room.creator ?? room.handle);
}

function roomUpdatedTimestamp(room: DiscoverableRoom): number {
  return Number(room.updatedAt ?? room.updated_at ?? room.createdAt ?? room.created_at ?? 0);
}

function roomCreatedTimestamp(room: DiscoverableRoom): number {
  return Number(room.createdAt ?? room.created_at ?? room.updatedAt ?? room.updated_at ?? 0);
}

function searchableText(room: DiscoverableRoom): string {
  return [
    room.name,
    room.creator,
    room.handle,
    room.focus,
    room.theme,
    room.entryLabel,
    room.entryPrice,
    room.customization?.welcomeNote,
    room.customization?.postingCadence,
    room.customization?.roomRules,
    ...(room.lockedDrops ?? []).map((drop) => `${drop.title ?? ""} ${drop.price ?? ""}`),
  ].join(" ").toLowerCase();
}

function hasPaidDrop(room: DiscoverableRoom): boolean {
  return (room.lockedDrops ?? []).some((drop) => drop.access === "paid-drop" || /\$\d+/.test(String(drop.price ?? "")));
}

function isFreePreviewRoom(room: DiscoverableRoom): boolean {
  const templateId = roomTemplateId(room);
  return templateId === "starter-room" || /\b(free|preview|\$0)\b/i.test(String(room.entryPrice ?? room.entryLabel ?? ""));
}

function isMemberRoom(room: DiscoverableRoom): boolean {
  const templateId = roomTemplateId(room);
  return templateId === "paid-cohort" || templateId === "starter-room" || /\b(member|supporter|cohort)\b/i.test(searchableText(room));
}

function matchesFilter(room: DiscoverableRoom, filter: RoomDiscoveryFilter, following: ReadonlySet<string>, now: number, newWindowMs: number): boolean {
  if (filter === "all") return true;
  if (filter === "following") return following.has(room.handle.toLowerCase());
  if (filter === "new") return roomCreatedTimestamp(room) > 0 && roomCreatedTimestamp(room) >= now - newWindowMs;
  if (filter === "active") return Number(room.members ?? 0) > 0;
  if (filter === "free-preview") return isFreePreviewRoom(room);
  if (filter === "member-rooms") return isMemberRoom(room);
  return roomTemplateId(room) === "studio-drop-room" || hasPaidDrop(room);
}

function recommendedScore(room: DiscoverableRoom, query: string, following: ReadonlySet<string>, now: number): number {
  const updatedAt = roomUpdatedTimestamp(room);
  const ageScore = updatedAt > 0 ? Math.max(0, 30 - Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24))) : 0;
  const followingScore = following.has(room.handle.toLowerCase()) ? 1000 : 0;
  const searchScore = query && searchableText(room).includes(query) ? 150 : 0;
  return followingScore + searchScore + Number(room.members ?? 0) + ageScore;
}

function compareRooms<Room extends DiscoverableRoom>(
  left: { room: Room; index: number },
  right: { room: Room; index: number },
  sort: RoomDiscoverySort,
  query: string,
  following: ReadonlySet<string>,
  now: number,
): number {
  if (sort === "newest") return roomCreatedTimestamp(right.room) - roomCreatedTimestamp(left.room) || left.index - right.index;
  if (sort === "most-members") return Number(right.room.members ?? 0) - Number(left.room.members ?? 0) || left.index - right.index;
  if (sort === "creator") return roomTitle(left.room).localeCompare(roomTitle(right.room)) || left.index - right.index;
  return recommendedScore(right.room, query, following, now) - recommendedScore(left.room, query, following, now) || left.index - right.index;
}

function emptyReason(query: string, filter: RoomDiscoveryFilter): string {
  if (query) return "No rooms match that search.";
  if (filter === "following") return "Follow creators to fill this view.";
  if (filter === "new") return "No new rooms match this window.";
  return "No rooms match this filter.";
}

export function discoverRooms<Room extends DiscoverableRoom>(
  rooms: readonly Room[],
  options: RoomDiscoveryOptions = {},
): RoomDiscoveryResult<Room> {
  const query = cleanQuery(options.query);
  const filter = validDiscoveryFilter(options.filter);
  const sort = validDiscoverySort(options.sort);
  const now = options.now ?? Date.now();
  const newWindowMs = options.newWindowMs ?? DEFAULT_NEW_WINDOW_MS;
  const following = new Set((options.followingHandles ?? []).flatMap((handle) => {
    const normalized = normalizedHandle(handle);
    return normalized ? [normalized] : [];
  }));
  const terms = query.split(" ").filter(Boolean);
  const filtered = rooms
    .map((room, index) => ({ room, index }))
    .filter(({ room }) => terms.every((term) => searchableText(room).includes(term)))
    .filter(({ room }) => matchesFilter(room, filter, following, now, newWindowMs))
    .sort((left, right) => compareRooms(left, right, sort, query, following, now));
  return {
    rooms: filtered.map(({ room }) => room),
    totalCount: rooms.length,
    visibleCount: filtered.length,
    query,
    filter,
    sort,
    emptyReason: filtered.length === 0 ? emptyReason(query, filter) : null,
  };
}
