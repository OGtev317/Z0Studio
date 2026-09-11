import {
  databaseOrResponse,
  errorResponse,
  json,
  requestParam,
  requireAccount,
  requireSameOrigin,
  validId,
  type PagesContext,
} from "../../_lib/z0studio-server";

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  const handle = requestParam(context, "handle");
  if (!validId(handle)) return json({ error: "HANDLE_INVALID" }, { status: 400 });
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const follow = await db.prepare("SELECT creator_handle FROM follows WHERE follower_id = ? AND creator_handle = ?")
    .bind(account.id, handle).first<{ creator_handle: string }>();
  return json({ following: Boolean(follow) });
}

export async function onRequestPut(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const handle = requestParam(context, "handle");
    if (!validId(handle)) return json({ error: "HANDLE_INVALID" }, { status: 400 });
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    await db.prepare("INSERT OR IGNORE INTO follows (follower_id, creator_handle, created_at) VALUES (?, ?, ?)")
      .bind(account.id, handle, Date.now()).run();
    return json({ following: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestDelete(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const handle = requestParam(context, "handle");
    if (!validId(handle)) return json({ error: "HANDLE_INVALID" }, { status: 400 });
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    await db.prepare("DELETE FROM follows WHERE follower_id = ? AND creator_handle = ?").bind(account.id, handle).run();
    return json({ following: false });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "PUT") return onRequestPut(context);
  if (context.request.method === "DELETE") return onRequestDelete(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET, PUT, DELETE" } });
}
