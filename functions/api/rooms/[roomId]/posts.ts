import {
  cleanLongText,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  requestParam,
  requireAccount,
  requireSameOrigin,
  validId,
  type PagesContext,
} from "../../../_lib/z0studio-server";

type Room = { owner_id: string };
type Membership = { state: string };
type RoomPost = { id: string; body: string; created_at: number; author: string; handle: string };

async function canReadRoom(db: NonNullable<ReturnType<typeof databaseOrResponse>>, roomId: string, accountId: string): Promise<boolean> {
  if (db instanceof Response) return false;
  const room = await db.prepare("SELECT owner_id FROM rooms WHERE id = ? AND status = 'published'").bind(roomId).first<Room>();
  if (!room) return false;
  if (room.owner_id === accountId) return true;
  const membership = await db.prepare("SELECT state FROM room_memberships WHERE room_id = ? AND user_id = ?")
    .bind(roomId, accountId).first<Membership>();
  return membership?.state === "active";
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  const roomId = requestParam(context, "roomId");
  if (!validId(roomId)) return json({ error: "ROOM_INVALID" }, { status: 400 });
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  if (!(await canReadRoom(db, roomId, account.id))) return json({ error: "ROOM_ACCESS_REQUIRED" }, { status: 403 });
  const rows = await db.prepare("SELECT room_posts.id, room_posts.body, room_posts.created_at, users.display_name AS author, users.handle FROM room_posts JOIN users ON users.id = room_posts.author_id WHERE room_posts.room_id = ? ORDER BY room_posts.created_at DESC LIMIT 100")
    .bind(roomId).all<RoomPost>();
  return json({ posts: rows.results ?? [] });
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
    if (room.owner_id !== account.id) return json({ error: "CREATOR_ROOM_REQUIRED" }, { status: 403 });
    const body = cleanLongText((await parseJsonObject(context.request)).body, "ROOM_POST_INVALID", 2_000);
    const post = { id: crypto.randomUUID(), body, createdAt: Date.now(), author: account.displayName, handle: account.handle };
    await db.prepare("INSERT INTO room_posts (id, room_id, author_id, body, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(post.id, roomId, account.id, post.body, post.createdAt).run();
    return json({ post }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET, POST" } });
}
