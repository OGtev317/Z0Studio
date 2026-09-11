import {
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  requestParam,
  requireAccount,
  requireSameOrigin,
  validId,
  type PagesContext,
} from "../../../../../_lib/z0studio-server";

type Room = { owner_id: string };

export async function onRequestPatch(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const roomId = requestParam(context, "roomId");
    const memberId = requestParam(context, "memberId");
    if (!validId(roomId) || !validId(memberId)) return json({ error: "MEMBERSHIP_INVALID" }, { status: 400 });
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    const room = await db.prepare("SELECT owner_id FROM rooms WHERE id = ?").bind(roomId).first<Room>();
    if (!room) return json({ error: "ROOM_NOT_FOUND" }, { status: 404 });
    if (room.owner_id !== account.id) return json({ error: "CREATOR_ROOM_REQUIRED" }, { status: 403 });
    const action = (await parseJsonObject(context.request)).action;
    const state = action === "approve" ? "active" : action === "block" ? "blocked" : action === "remove" ? "removed" : undefined;
    if (!state) return json({ error: "MEMBERSHIP_ACTION_INVALID" }, { status: 400 });
    const result = await db.prepare("UPDATE room_memberships SET state = ?, decided_at = ?, decided_by = ? WHERE room_id = ? AND user_id = ?")
      .bind(state, Date.now(), account.id, roomId, memberId).run() as { meta?: { changes?: number } };
    if (!result.meta?.changes) return json({ error: "MEMBERSHIP_NOT_FOUND" }, { status: 404 });
    return json({ state });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "PATCH") return onRequestPatch(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "PATCH" } });
}
