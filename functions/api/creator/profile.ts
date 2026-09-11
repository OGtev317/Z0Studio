import {
  cleanDisplayName,
  cleanLongText,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  requireAccount,
  requireSameOrigin,
  type PagesContext,
} from "../../_lib/z0studio-server";

type Profile = { display_name: string; bio: string; role: "member" | "creator" };

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const account = await requireAccount(context);
  if (account instanceof Response) return account;
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const profile = await db.prepare("SELECT display_name, bio, role FROM users WHERE id = ?").bind(account.id).first<Profile>();
  return json({ profile: profile ? { displayName: profile.display_name, bio: profile.bio, role: profile.role } : null });
}

export async function onRequestPatch(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const body = await parseJsonObject(context.request);
    const displayName = cleanDisplayName(body.displayName ?? account.displayName);
    const bio = cleanLongText(body.bio ?? "Creator", "CREATOR_BIO_INVALID", 320);
    const role: "member" | "creator" = body.role === "creator" ? "creator" : account.role;
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    await db.prepare("UPDATE users SET display_name = ?, bio = ?, role = ? WHERE id = ?")
      .bind(displayName, bio, role, account.id).run();
    return json({ profile: { displayName, bio, role } });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequest(context: PagesContext): Promise<Response> {
  if (context.request.method === "GET") return onRequestGet(context);
  if (context.request.method === "PATCH") return onRequestPatch(context);
  return json({ error: "METHOD_NOT_ALLOWED" }, { status: 405, headers: { allow: "GET, PATCH" } });
}
