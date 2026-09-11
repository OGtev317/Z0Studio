import { databaseOrResponse, json, requireAccount, type PagesContext } from "../../_lib/z0studio-server";
import {
  roomCustomizationFromDatabaseRow,
  type RoomCustomizationDatabaseRow,
} from "../../../src/lib/z0studio-room-customization";

type RoomRow = {
  id: string;
  name: string;
  focus: string;
  template_id: string;
  entry_label: string;
  status: "draft" | "published" | "archived";
  created_at: number;
  updated_at: number;
  pending_members: number;
  active_members: number;
} & RoomCustomizationDatabaseRow;

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  if (account.role !== "creator") return json({ error: "CREATOR_ACCOUNT_REQUIRED" }, { status: 403 });
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const rows = await db.prepare(`
    SELECT rooms.id, rooms.name, rooms.focus, rooms.template_id, rooms.entry_label, rooms.status, rooms.created_at, rooms.updated_at,
      rooms.accent_color, rooms.cover_style, rooms.welcome_note, rooms.posting_cadence, rooms.room_rules,
      (SELECT COUNT(*) FROM room_memberships WHERE room_memberships.room_id = rooms.id AND room_memberships.state = 'pending') AS pending_members,
      (SELECT COUNT(*) FROM room_memberships WHERE room_memberships.room_id = rooms.id AND room_memberships.state = 'active') AS active_members
    FROM rooms WHERE owner_id = ? ORDER BY updated_at DESC`).bind(account.id).all<RoomRow>();
  return json({ rooms: (rows.results ?? []).map((room) => ({ ...room, customization: roomCustomizationFromDatabaseRow(room) })) });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET" } });
}
