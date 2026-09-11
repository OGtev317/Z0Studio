import { databaseOrResponse, json, requireAccount, type PagesContext } from "../../_lib/z0studio-server";

type ReportRow = { id: string; room_id: string | null; subject_type: string; subject_id: string; reason: string; status: string; created_at: number };

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  if (account.role !== "creator") return json({ error: "CREATOR_ACCOUNT_REQUIRED" }, { status: 403 });
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const reports = await db.prepare("SELECT reports.id, reports.room_id, reports.subject_type, reports.subject_id, reports.reason, reports.status, reports.created_at FROM reports JOIN rooms ON rooms.id = reports.room_id WHERE rooms.owner_id = ? ORDER BY reports.created_at DESC LIMIT 100")
    .bind(account.id).all<ReportRow>();
  return json({ reports: reports.results ?? [] });
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET" } });
}
