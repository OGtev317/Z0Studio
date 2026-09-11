export type D1Result<T> = { results?: T[] };

export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
};

export type D1DatabaseBinding = {
  prepare(query: string): D1PreparedStatement;
};

export type Z0StudioEnv = {
  Z0STUDIO_DB?: D1DatabaseBinding;
};

export type PagesContext = {
  request: Request;
  env: Z0StudioEnv;
  params?: Record<string, string | string[] | undefined>;
};

export type Account = {
  id: string;
  email: string;
  displayName: string;
  handle: string;
  role: "member" | "creator";
  createdAt: number;
};

type StoredAccount = {
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

export const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

const PASSWORD_ITERATIONS = 310_000;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_COOKIE = "z0studio_session";
const textEncoder = new TextEncoder();

export function json(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers ?? {}) },
  });
}

export function databaseOrResponse(context: PagesContext): D1DatabaseBinding | Response {
  return context.env.Z0STUDIO_DB ?? json({ error: "SERVICE_UNAVAILABLE" }, { status: 503 });
}

export function requestParam(context: PagesContext, name: string): string | undefined {
  const value = context.params?.[name];
  return typeof value === "string" ? value : undefined;
}

export function validId(value: string | undefined): value is string {
  return Boolean(value && /^[a-zA-Z0-9-]{1,64}$/.test(value));
}

export async function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new Error("JSON_REQUIRED");
  }
  const value = await request.json();
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("JSON_REQUIRED");
  return value as Record<string, unknown>;
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) throw new Error("ORIGIN_REQUIRED");
}

export function cleanDisplayName(value: unknown): string {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > 64) throw new Error("DISPLAY_NAME_INVALID");
  return normalized;
}

export function cleanHandle(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,23}$/.test(normalized)) throw new Error("HANDLE_INVALID");
  return normalized;
}

export function cleanEmail(value: unknown): string {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) throw new Error("EMAIL_INVALID");
  return normalized;
}

export function cleanPassword(value: unknown): string {
  const password = String(value ?? "");
  if (password.length < 12 || password.length > 128) throw new Error("PASSWORD_INVALID");
  return password;
}

export function cleanShortText(value: unknown, code: string, maximum: number): string {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  if (normalized.length < 2 || normalized.length > maximum) throw new Error(code);
  return normalized;
}

export function cleanLongText(value: unknown, code: string, maximum: number): string {
  const normalized = String(value ?? "").trim();
  if (normalized.length < 2 || normalized.length > maximum) throw new Error(code);
  return normalized;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: Uint8Array.from(salt), iterations }, key, 256);
  return new Uint8Array(bits);
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createPasswordRecord(password: string): Promise<{ hash: string; salt: string; iterations: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt, PASSWORD_ITERATIONS);
  return { hash: encodeBase64Url(hash), salt: encodeBase64Url(salt), iterations: PASSWORD_ITERATIONS };
}

export async function verifyPassword(password: string, record: { password_hash: string; password_salt: string; password_iterations: number }): Promise<boolean> {
  const candidate = await derivePasswordHash(password, decodeBase64Url(record.password_salt), record.password_iterations);
  return equalBytes(candidate, decodeBase64Url(record.password_hash));
}

async function hashSessionToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(token));
  return encodeBase64Url(new Uint8Array(digest));
}

export async function allowFixedWindowRequest(
  db: D1DatabaseBinding,
  scope: string,
  material: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const keyHash = await hashSessionToken(material);
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const result = await db.prepare("INSERT INTO request_rate_limits (scope, key_hash, window_start, count) VALUES (?, ?, ?, 1) ON CONFLICT(scope, key_hash, window_start) DO UPDATE SET count = count + 1 RETURNING count")
    .bind(scope, keyHash, windowStart).first<{ count: number }>();
  return (result?.count ?? limit + 1) <= limit;
}

export function requestClientKey(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown-client";
}

function cookieValue(request: Request, name: string): string | undefined {
  const segment = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return segment?.slice(name.length + 1);
}

function sessionCookie(value: string, request: Request, maxAge: number): string {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function publicAccount(row: StoredAccount): Account {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    handle: row.handle,
    role: row.role,
    createdAt: row.created_at,
  };
}

export async function createSession(db: D1DatabaseBinding, accountId: string, request: Request, now = Date.now()): Promise<string> {
  const token = encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(crypto.randomUUID(), accountId, await hashSessionToken(token), now + SESSION_MAX_AGE_SECONDS * 1000, now)
    .run();
  return sessionCookie(token, request, SESSION_MAX_AGE_SECONDS);
}

export async function destroySession(db: D1DatabaseBinding, request: Request): Promise<string> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (token) {
    await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashSessionToken(token)).run();
  }
  return sessionCookie("", request, 0);
}

export async function accountFromSession(db: D1DatabaseBinding, request: Request, now = Date.now()): Promise<Account | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const account = await db.prepare(
    "SELECT users.id, users.email, users.display_name, users.handle, users.role, users.created_at, users.password_hash, users.password_salt, users.password_iterations FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
  ).bind(await hashSessionToken(token), now).first<StoredAccount>();
  return account ? publicAccount(account) : null;
}

export async function requireAccount(context: PagesContext): Promise<Account | Response> {
  const db = databaseOrResponse(context);
  if (db instanceof Response) return db;
  const account = await accountFromSession(db, context.request);
  return account ?? json({ error: "AUTH_REQUIRED" }, { status: 401 });
}

export function errorResponse(error: unknown): Response {
  const code = error instanceof Error ? error.message : "REQUEST_REJECTED";
  const status = code === "ORIGIN_REQUIRED" ? 403
    : code === "JSON_REQUIRED" ? 415
      : code.endsWith("_INVALID") || code.endsWith("_REQUIRED") ? 400
        : 400;
  return json({ error: code }, { status });
}
