import {
  createPublicFeedPost,
  type PublicFeedPost,
} from "../../src/lib/public-feed";
import { socialPosts } from "../../src/lib/social-content";
import {
  cleanLongText,
  databaseOrResponse,
  errorResponse,
  json,
  parseJsonObject,
  requireAccount,
  requireSameOrigin,
  type D1DatabaseBinding,
  type D1PreparedStatement,
  type PagesContext,
} from "../_lib/z0studio-server";

export type { D1DatabaseBinding, D1PreparedStatement } from "../_lib/z0studio-server";

type FeedRow = {
  author: string;
  handle: string;
  title: string;
  body: string;
  created_at: number;
};

const FALLBACK_POSTS = socialPosts.map((post) => createPublicFeedPost({
  author: post.author,
  handle: post.handle,
  title: post.title,
  body: post.body,
  createdAt: post.createdAt,
  source: "seed",
}));

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const db = databaseOrResponse(context);
  if (db instanceof Response) return json({ posts: FALLBACK_POSTS, mode: "local-fallback", publishingEnabled: false });
  const rows = await db.prepare("SELECT author, handle, title, body, created_at FROM public_posts ORDER BY created_at DESC LIMIT 50").all<FeedRow>();
  return json({ posts: rowsToPosts(rows.results ?? []), mode: "shared", publishingEnabled: true });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  try {
    requireSameOrigin(context.request);
    const account = await requireAccount(context);
    if (account instanceof Response) return account;
    const db = databaseOrResponse(context);
    if (db instanceof Response) return db;
    const body = await parseJsonObject(context.request);
    const now = Date.now();
    if (await isRateLimited(db, account.id, now)) {
      return json({ error: "PUBLIC_POST_RATE_LIMITED" }, { status: 429, headers: { "retry-after": "60" } });
    }
    const post = createPublicFeedPost({
      author: account.displayName,
      handle: account.handle,
      title: typeof body.title === "string" ? body.title : "Creator update",
      body: cleanLongText(body.body, "PUBLIC_POST_INVALID", 420),
      createdAt: now,
      source: "shared",
    });
    await db.prepare("INSERT INTO public_posts (id, author_id, author, handle, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), account.id, post.author, post.handle, post.title, post.body, post.createdAt).run();
    return json({ post }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function readPosts(db: D1DatabaseBinding): Promise<PublicFeedPost[]> {
  const rows = await db
    .prepare(
      "SELECT author, handle, title, body, created_at FROM public_posts ORDER BY created_at DESC LIMIT 50",
    )
    .all<FeedRow>();
  return rowsToPosts(rows.results ?? []);
}

function rowsToPosts(rows: readonly FeedRow[]): PublicFeedPost[] {
  return rows.flatMap((row) => {
    try {
      return [createPublicFeedPost({
        author: row.author,
        handle: row.handle,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        source: "shared",
      })];
    } catch {
      return [];
    }
  });
}

export async function isRateLimited(db: D1DatabaseBinding, handle: string, now: number): Promise<boolean> {
  const windowStart = now - 60_000;
  const rows = await db
    .prepare("SELECT id FROM public_posts WHERE author_id = ? AND created_at >= ? ORDER BY created_at DESC LIMIT 5")
    .bind(handle, windowStart)
    .all<{ id: string }>();
  return (rows.results ?? []).length >= 5;
}
