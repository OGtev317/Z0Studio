import {
  allowFixedWindowRequest,
  cleanDisplayName,
  cleanEmail,
  cleanHandle,
  cleanPassword,
  createPasswordRecord,
  createSession,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  publicAccount,
  requestClientKey,
  requireSameOrigin,
  type PagesContext,
} from "../../_lib/z0studio-server";

type ExistingAccount = { id: string };

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    if (!(await allowFixedWindowRequest(db, "account-register", requestClientKey(context.request), 5, 60 * 60 * 1000))) {
      return json({ error: "ACCOUNT_REGISTRATION_RATE_LIMITED" }, { status: 429, headers: { "retry-after": "3600" } });
    }
    const body = await parseJsonObject(context.request);
    const email = cleanEmail(body.email);
    const handle = cleanHandle(body.handle);
    const displayName = cleanDisplayName(body.displayName);
    const password = cleanPassword(body.password);
    const role: "member" | "creator" = body.role === "creator" ? "creator" : "member";
    const existing = await db.prepare("SELECT id FROM users WHERE email = ? OR handle = ? LIMIT 1").bind(email, handle).first<ExistingAccount>();
    if (existing) return json({ error: "ACCOUNT_ALREADY_EXISTS" }, { status: 409 });
    const passwordRecord = await createPasswordRecord(password);
    const account = { id: crypto.randomUUID(), email, handle, display_name: displayName, role, created_at: Date.now() };
    await db.prepare("INSERT INTO users (id, email, display_name, handle, role, password_hash, password_salt, password_iterations, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(account.id, account.email, account.display_name, account.handle, account.role, passwordRecord.hash, passwordRecord.salt, passwordRecord.iterations, account.created_at)
      .run();
    const cookie = await createSession(db, account.id, context.request, account.created_at);
    return json({ account: publicAccount({ ...account, ...passwordRecord, password_hash: passwordRecord.hash, password_salt: passwordRecord.salt, password_iterations: passwordRecord.iterations }) }, { status: 201, headers: { "set-cookie": cookie } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "POST" } });
}
