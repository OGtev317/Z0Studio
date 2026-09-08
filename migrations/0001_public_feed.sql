CREATE TABLE IF NOT EXISTS public_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author TEXT NOT NULL,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_public_posts_created_at
  ON public_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_public_posts_handle_created_at
  ON public_posts (handle, created_at DESC);
