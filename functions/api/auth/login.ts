import {
  allowFixedWindowRequest,
  cleanEmail,
  cleanPassword,
  createSession,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  publicAccount,
  requestClientKey,
  requireSameOrigin,
  verifyPassword,
  type PagesContext,
} from "../../_lib/z0studio-server";

type LoginAccount = {
  id: string;
  email: string;
  display_name: string;
  handle: string;
  role: "member" | "creator";
  created_at: number;
  password_hash: string;
  password_salt: string;
  password_iterations: number;
};

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    const body = await parseJsonObject(context.request);
    const email = cleanEmail(body.email);
    const password = cleanPassword(body.password);
    if (!(await allowFixedWindowRequest(db, "account-login", `${requestClientKey(context.request)}:${email}`, 10, 60 * 60 * 1000))) {
      return json({ error: "ACCOUNT_LOGIN_RATE_LIMITED" }, { status: 429, headers: { "retry-after": "3600" } });
    }
    const account = await db.prepare("SELECT id, email, display_name, handle, role, created_at, password_hash, password_salt, password_iterations FROM users WHERE email = ? LIMIT 1")
      .bind(email).first<LoginAccount>();
    if (!account || !(await verifyPassword(password, account))) return json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    const cookie = await createSession(db, account.id, context.request);
    return json({ account: publicAccount(account) }, { headers: { "set-cookie": cookie } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "POST" } });
}
