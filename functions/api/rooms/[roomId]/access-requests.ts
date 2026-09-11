import {
  databaseOrResponse,
  errorResponse,
  json,
  requestParam,
  requireAccount,
  requireSameOrigin,
  validId,
  type PagesContext,
} from "../../../_lib/z0studio-server";

type Room = { owner_id: string };
type Membership = { state: "pending" | "active" | "blocked" | "removed" };

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  const roomId = requestParam(context, "roomId");
  if (!validId(roomId)) return json({ error: "ROOM_INVALID" }, { status: 400 });
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const membership = await db.prepare("SELECT state FROM room_memberships WHERE room_id = ? AND user_id = ?")
    .bind(roomId, account.id).first<Membership>();
  return json({ state: membership?.state ?? "none", canEnter: membership?.state === "active" });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const roomId = requestParam(context, "roomId");
    if (!validId(roomId)) return json({ error: "ROOM_INVALID" }, { status: 400 });
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    const room = await db.prepare("SELECT owner_id FROM rooms WHERE id = ? AND status = 'published'").bind(roomId).first<Room>();
    if (!room) return json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
    if (room.owner_id === account.id) return json({ error: "ROOM_OWNER_CANNOT_REQUEST" }, { status: 400 });
    const existing = await db.prepare("SELECT state FROM room_memberships WHERE room_id = ? AND user_id = ?")
      .bind(roomId, account.id).first<Membership>();
    if (existing?.state === "blocked") return json({ error: "ACCESS_NOT_AVAILABLE" }, { status: 403 });
    if (existing?.state === "active") return json({ state: "active", canEnter: true });
    const now = Date.now();
    await db.prepare("INSERT INTO room_memberships (room_id, user_id, state, requested_at) VALUES (?, ?, 'pending', ?) ON CONFLICT(room_id, user_id) DO UPDATE SET state = 'pending', requested_at = excluded.requested_at, decided_at = NULL, decided_by = NULL")
      .bind(roomId, account.id, now).run();
    return json({ state: "pending", canEnter: false }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET, POST" } });
}
