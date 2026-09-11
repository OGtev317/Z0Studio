import {
  databaseOrResponse,
  json,
  requestParam,
  requireAccount,
  validId,
  type PagesContext,
} from "../../../../_lib/z0studio-server";

type Room = { owner_id: string };
type Member = { id: string; display_name: string; handle: string; state: string; requested_at: number; decided_at: number | null };

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  const roomId = requestParam(context, "roomId");
  if (!validId(roomId)) return json({ error: "ROOM_INVALID" }, { status: 400 });
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const room = await db.prepare("SELECT owner_id FROM rooms WHERE id = ?").bind(roomId).first<Room>();
  if (!room) return json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
  if (room.owner_id !== account.id) return json({ error: "CREATOR_ROOM_REQUIRED" }, { status: 403 });
  const members = await db.prepare("SELECT users.id, users.display_name, users.handle, room_memberships.state, room_memberships.requested_at, room_memberships.decided_at FROM room_memberships JOIN users ON users.id = room_memberships.user_id WHERE room_memberships.room_id = ? ORDER BY room_memberships.requested_at DESC")
    .bind(roomId).all<Member>();
  return json({ members: members.results ?? [] });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET" } });
}
