import {
  createPublicFeedPost,
  type PublicFeedPost,
  type PublicFeedPostInput,
} from "../../src/lib/public-feed";
import { socialPosts } from "../../src/lib/social-content";

type PublicFeedPostDraft = Omit<PublicFeedPostInput, "createdAt">;
type D1Result<T> = { results?: T[] };
export type D1PreparedStatement = {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
};
export type D1DatabaseBinding = {
  prepare(query: string): D1PreparedStatement;
};

type Env = {
  ZEEROSTREAM_FEED_DB?: D1DatabaseBinding;
};

type PagesContext = {
  request: Request;
  env: Env;
};

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

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

export async function onRequestGet(context: PagesContext): Promise<Response> {
  // Shared creator identity verification is not implemented in this release.
  return Response.json({ posts: FALLBACK_POSTS, mode: "local-fallback", publishingEnabled: false }, { headers: JSON_HEADERS });
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  if (!context.env.ZEEROSTREAM_FEED_DB) {
    return Response.json({ error: "PUBLIC_FEED_STORAGE_NOT_CONFIGURED" }, { status: 503, headers: JSON_HEADERS });
  }
  return Response.json({ error: "PUBLIC_FEED_PUBLISHING_DISABLED" }, { status: 403, headers: JSON_HEADERS });
}

export async function readPosts(db: D1DatabaseBinding): Promise<PublicFeedPost[]> {
  const rows = await db
    .prepare(
      "SELECT author, handle, title, body, created_at FROM public_posts ORDER BY created_at DESC LIMIT 50",
    )
    .all<FeedRow>();
  return (rows.results ?? []).flatMap((row) => {
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
    .prepare("SELECT created_at FROM public_posts WHERE handle = ?1 AND created_at >= ?2 ORDER BY created_at DESC LIMIT 5")
    .bind(handle, windowStart)
    .all<{ created_at: number }>();
  return (rows.results ?? []).length >= 5;
}

async function parsePostBody(request: Request): Promise<PublicFeedPostDraft> {
  if (request.headers.get("content-type")?.includes("application/json") !== true) {
    throw new Error("PUBLIC_POST_JSON_REQUIRED");
  }
  const parsed = await request.json() as Partial<PublicFeedPostInput>;
  return {
    author: String(parsed.author ?? ""),
    handle: String(parsed.handle ?? ""),
    title: typeof parsed.title === "string" ? parsed.title : undefined,
    body: String(parsed.body ?? ""),
    source: "shared",
  };
}
