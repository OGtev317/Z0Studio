import { databaseOrResponse, destroySession, errorResponse, json, requireSameOrigin, type PagesContext } from "../../_lib/z0studio-server";

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    return json({ ok: true }, { headers: { "set-cookie": await destroySession(db, context.request) } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "POST" } });
}
