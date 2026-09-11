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
} from "../../../_lib/z0studio-server";

export async function onRequestPatch(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    if (account.role !== "creator") return json({ error: "CREATOR_ACCOUNT_REQUIRED" }, { status: 403 });
    const reportId = requestParam(context, "reportId");
    if (!validId(reportId)) return json({ error: "REPORT_INVALID" }, { status: 400 });
    const action = (await parseJsonObject(context.request)).action;
    const status = action === "review" ? "reviewed" : action === "resolve" ? "resolved" : undefined;
    if (!status) return json({ error: "REPORT_ACTION_INVALID" }, { status: 400 });
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    const result = await db.prepare("UPDATE reports SET status = ?, resolved_at = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_at END, resolved_by = CASE WHEN ? = 'resolved' THEN ? ELSE resolved_by END WHERE id = ? AND room_id IN (SELECT id FROM rooms WHERE owner_id = ?)")
      .bind(status, status, Date.now(), status, account.id, reportId, account.id).run() as { meta?: { changes?: number } };
    if (!result.meta?.changes) return json({ error: "REPORT_NOT_FOUND" }, { status: 404 });
    return json({ status });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "PATCH") return onRequestPatch(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "PATCH" } });
}
