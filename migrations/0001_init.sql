CREATE TABLE users (
  id TEXT PRIMARY KEY,            -- Discord user id
  nickname TEXT NOT NULL,         -- server-specific nickname
  avatar_url TEXT,
  first_login INTEGER NOT NULL,
  last_login INTEGER NOT NULL
);

CREATE TABLE albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  year INTEGER,
  cover_url TEXT,
  week INTEGER NOT NULL,
  added_at INTEGER NOT NULL
);

CREATE TABLE rankings (
  user_id TEXT NOT NULL REFERENCES users(id),
  album_id INTEGER NOT NULL REFERENCES albums(id),
  tier TEXT NOT NULL CHECK (tier IN ('S','A','B','C','D','F')),
  position INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, album_id)
);

CREATE INDEX idx_rankings_album ON rankings(album_id);
