import {
  cleanLongText,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  requireAccount,
  requireSameOrigin,
  validId,
  type PagesContext,
} from "../_lib/z0studio-server";

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const body = await parseJsonObject(context.request);
    const subjectType = body.subjectType === "room" || body.subjectType === "post" || body.subjectType === "account" ? body.subjectType : undefined;
    const subjectId = typeof body.subjectId === "string" ? body.subjectId : undefined;
    const roomId = typeof body.roomId === "string" ? body.roomId : undefined;
    if (!subjectType || !validId(subjectId) || (roomId && !validId(roomId))) return json({ error: "REPORT_SUBJECT_INVALID" }, { status: 400 });
    const reason = cleanLongText(body.reason, "REPORT_REASON_INVALID", 1_000);
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    await db.prepare("INSERT INTO reports (id, reporter_id, room_id, subject_type, subject_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)")
      .bind(crypto.randomUUID(), account.id, roomId ?? null, subjectType, subjectId, reason, Date.now()).run();
    return json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "POST" } });
}
