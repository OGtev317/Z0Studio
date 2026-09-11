DROP INDEX IF EXISTS idx_public_posts_created_at;
DROP INDEX IF EXISTS idx_public_posts_handle_created_at;
DROP TABLE IF EXISTS public_posts;

CREATE TABLE public_posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX public_posts_created_index ON public_posts(created_at DESC);
CREATE INDEX public_posts_author_index ON public_posts(author_id, created_at DESC);
