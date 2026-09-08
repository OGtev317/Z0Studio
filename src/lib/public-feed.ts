const MAX_PUBLIC_POST_BYTES = 420;
const PRIVATE_FIELD_PATTERN =
  /(private[_-]?key|viewing[_-]?key|seed|mnemonic|witness\s*[:=]|proof\s*[:=]|note[_-]?secret|private[_-]?balance|memo plaintext)/i;

export type PublicFeedPostInput = {
  author: string;
  handle: string;
  body: string;
  title?: string;
  createdAt: number;
  source?: "seed" | "local" | "shared";
};

export type PublicFeedPost = {
  author: string;
  handle: string;
  body: string;
  title: string;
  createdAt: number;
  visibility: "Public";
  source: "seed" | "local" | "shared";
  status: "published";
};

export type PublicFeedMode = "shared" | "local-fallback";

export type PublicFeedResponse = {
  posts: PublicFeedPost[];
  mode: PublicFeedMode;
};

export function parsePublicFeedResponse(value: unknown): PublicFeedResponse {
  const record = value as { posts?: unknown; mode?: unknown };
  if (!Array.isArray(record.posts)) throw new Error("PUBLIC_FEED_RESPONSE_INVALID");
  const mode = record.mode === "shared" ? "shared" : "local-fallback";
  return {
    mode,
    posts: record.posts.flatMap((item) => {
      try {
        return [createPublicFeedPost(item as PublicFeedPostInput)];
      } catch {
        return [];
      }
    }),
  };
}

export function createPublicFeedPost(input: PublicFeedPostInput): PublicFeedPost {
  const author = cleanText(input.author);
  const handle = cleanHandle(input.handle);
  const body = cleanText(input.body);
  const title = cleanText(input.title ?? "Public creator update");
  if (!author || !handle || !body || !Number.isInteger(input.createdAt) || input.createdAt <= 0) {
    throw new Error("PUBLIC_POST_INVALID");
  }
  assertPublicText(`${author} ${handle} ${title} ${body}`);
  if (new TextEncoder().encode(body).length > MAX_PUBLIC_POST_BYTES) throw new Error("PUBLIC_POST_TOO_LONG");
  return {
    author,
    handle,
    body,
    title,
    createdAt: input.createdAt,
    visibility: "Public",
    source: input.source === "seed" || input.source === "shared" ? input.source : "local",
    status: "published",
  };
}

export function parsePublicFeedHistory(value: string | null): PublicFeedPost[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      try {
        const post = item as PublicFeedPostInput;
        return [createPublicFeedPost(post)];
      } catch {
        return [];
      }
    }).slice(0, 20);
  } catch {
    return [];
  }
}

export function updatePublicFeedHistory(posts: readonly PublicFeedPost[], post: PublicFeedPost): PublicFeedPost[] {
  return [
    post,
    ...posts.filter((entry) => !(entry.createdAt === post.createdAt && entry.handle === post.handle)),
  ].slice(0, 20);
}

function assertPublicText(value: string): void {
  if (PRIVATE_FIELD_PATTERN.test(value)) throw new Error("PUBLIC_POST_PRIVATE_MATERIAL");
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function cleanHandle(value: string): string {
  return cleanText(value).replace(/^@/, "").toLowerCase();
}
