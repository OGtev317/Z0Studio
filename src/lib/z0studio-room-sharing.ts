export type RoomShareInput = {
  roomId: string;
  handle: string;
  roomName: string;
  creatorName: string;
  origin?: string;
};

export type RoomShareTarget = {
  roomId: string;
  handle: string;
  roomHref: string;
  profileHref: string;
  roomUrl: string;
  profileUrl: string;
  title: string;
  postText: string;
  copyText: string;
};

const roomIdPattern = /^[a-zA-Z0-9-]{1,64}$/;
const handlePattern = /^[a-z0-9][a-z0-9-]{2,23}$/;
const privateMaterialPattern = /\b(private[\s_-]*key|seed[\s_-]*phrase|viewing[\s_-]*key|witness|memo[\s_-]*plaintext|private[\s_-]*balance)\b/i;

function cleanRoomId(value: string): string {
  const normalized = value.trim();
  if (!roomIdPattern.test(normalized)) throw new Error("ROOM_SHARE_ID_INVALID");
  return normalized;
}

function cleanHandle(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!handlePattern.test(normalized)) throw new Error("ROOM_SHARE_HANDLE_INVALID");
  return normalized;
}

function cleanShareText(value: string, fallback: string, maximum: number, code: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > maximum) throw new Error(code);
  if (privateMaterialPattern.test(normalized)) throw new Error(code);
  return normalized || fallback;
}

function absoluteUrl(origin: string | undefined, href: string): string {
  if (!origin) return href;
  const url = new URL(origin);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("ROOM_SHARE_ORIGIN_INVALID");
  return new URL(href, url.origin).toString();
}

export function buildRoomShareTarget(input: RoomShareInput): RoomShareTarget {
  const roomId = cleanRoomId(input.roomId);
  const handle = cleanHandle(input.handle);
  const roomName = cleanShareText(input.roomName, "Room", 64, "ROOM_SHARE_NAME_INVALID");
  const creatorName = cleanShareText(input.creatorName, handle, 64, "ROOM_SHARE_CREATOR_INVALID");
  const roomHref = `/rooms#${encodeURIComponent(roomId)}`;
  const profileHref = `/profiles#${encodeURIComponent(handle)}`;
  const roomUrl = absoluteUrl(input.origin, roomHref);
  const profileUrl = absoluteUrl(input.origin, profileHref);
  const title = `${roomName} on Z0Studio`;
  const postText = `Join ${roomName} by ${creatorName} on Z0Studio.`;
  return {
    roomId,
    handle,
    roomHref,
    profileHref,
    roomUrl,
    profileUrl,
    title,
    postText,
    copyText: `${postText} ${roomUrl}`,
  };
}
