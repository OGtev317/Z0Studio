import {
  cleanLongText,
  cleanShortText,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  requireAccount,
  requireSameOrigin,
  type PagesContext,
} from "../_lib/z0studio-server";
import {
  normalizeRoomCustomization,
  roomCustomizationFromDatabaseRow,
  roomCustomizationToDatabaseValues,
  type RoomCustomizationDatabaseRow,
} from "../../src/lib/z0studio-room-customization";

type RoomRow = {
  id: string;
  owner_id: string;
  name: string;
  focus: string;
  template_id: string;
  entry_label: string;
  status: "draft" | "published" | "archived";
  created_at: number;
  updated_at: number;
  creator: string;
  handle: string;
  members: number;
} & RoomCustomizationDatabaseRow;

const ROOM_TEMPLATES = new Set(["starter-room", "paid-cohort", "studio-drop-room"]);

function roomPayload(room: RoomRow) {
  return {
    id: room.id,
    creatorId: room.owner_id,
    creator: room.creator,
    handle: room.handle,
    name: room.name,
    focus: room.focus,
    templateId: room.template_id,
    entryLabel: room.entry_label,
    status: room.status,
    members: room.members,
    customization: roomCustomizationFromDatabaseRow(room),
    createdAt: room.created_at,
    updatedAt: room.updated_at,
  };
}

const PUBLIC_ROOM_QUERY = `
  SELECT rooms.id, rooms.owner_id, rooms.name, rooms.focus, rooms.template_id, rooms.entry_label, rooms.status, rooms.created_at, rooms.updated_at,
    rooms.accent_color, rooms.cover_style, rooms.welcome_note, rooms.posting_cadence, rooms.room_rules,
    users.display_name AS creator, users.handle AS handle,
    (SELECT COUNT(*) FROM room_memberships WHERE room_memberships.room_id = rooms.id AND room_memberships.state = 'active') AS members
  FROM rooms JOIN users ON users.id = rooms.owner_id WHERE rooms.status = 'published' ORDER BY rooms.updated_at DESC LIMIT 50`;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const rows = await db.prepare(PUBLIC_ROOM_QUERY).all<RoomRow>();
  return json({ rooms: (rows.results ?? []).map(roomPayload) });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    if (account.role !== "creator") return json({ error: "CREATOR_ACCOUNT_REQUIRED" }, { status: 403 });
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    const body = await parseJsonObject(context.request);
    const templateId = String(body.templateId ?? "");
    if (!ROOM_TEMPLATES.has(templateId)) return json({ error: "ROOM_TEMPLATE_INVALID" }, { status: 400 });
    const name = cleanShortText(body.name, "ROOM_NAME_INVALID", 48);
    const focus = cleanLongText(body.focus, "ROOM_FOCUS_INVALID", 240);
    const entryLabel = cleanShortText(body.entryLabel ?? "Request to join", "ROOM_ENTRY_INVALID", 32);
    const customization = normalizeRoomCustomization((body.customization ?? {}) as Record<string, unknown>);
    const customizationValues = roomCustomizationToDatabaseValues(customization);
    const now = Date.now();
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO rooms (id, owner_id, name, focus, template_id, entry_label, status, accent_color, cover_style, welcome_note, posting_cadence, room_rules, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?)")
      .bind(
        id,
        account.id,
        name,
        focus,
        templateId,
        entryLabel,
        customizationValues.accent_color,
        customizationValues.cover_style,
        customizationValues.welcome_note,
        customizationValues.posting_cadence,
        customizationValues.room_rules,
        now,
        now,
      ).run();
    return json({
      room: {
        id,
        creatorId: account.id,
        creator: account.displayName,
        handle: account.handle,
        name,
        focus,
        templateId,
        entryLabel,
        status: "published",
        members: 0,
        customization,
        createdAt: now,
        updatedAt: now,
      },
    }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET, POST" } });
}
