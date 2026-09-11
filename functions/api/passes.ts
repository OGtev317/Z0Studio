import { databaseOrResponse, json, requireAccount, type PagesContext } from "../_lib/z0studio-server";

type Pass = {
  room_id: string;
  name: string;
  focus: string;
  state: "pending" | "active" | "blocked" | "removed";
  requested_at: number;
  decided_at: number | null;
  updated_at: number;
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const rows = await db.prepare("SELECT room_memberships.room_id, rooms.name, rooms.focus, room_memberships.state, room_memberships.requested_at, room_memberships.decided_at, COALESCE(room_memberships.decided_at, room_memberships.requested_at) AS updated_at FROM room_memberships JOIN rooms ON rooms.id = room_memberships.room_id WHERE room_memberships.user_id = ? ORDER BY updated_at DESC")
    .bind(account.id).all<Pass>();
  return json({ passes: rows.results ?? [] });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET" } });
}
