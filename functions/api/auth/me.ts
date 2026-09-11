import { accountFromSession, databaseOrResponse, json, type PagesContext } from "../../_lib/z0studio-server";

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  return json({ account: await accountFromSession(db, context.request) });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET" } });
}
