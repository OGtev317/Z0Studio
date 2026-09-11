import { databaseOrResponse, json, requireAccount, type PagesContext } from "../_lib/z0studio-server";

type Follow = { creator_handle: string };

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const follows = await db.prepare("SELECT creator_handle FROM follows WHERE follower_id = ? ORDER BY created_at DESC LIMIT 250")
    .bind(account.id).all<Follow>();
  return json({ handles: (follows.results ?? []).map((follow) => follow.creator_handle) });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET" } });
}
