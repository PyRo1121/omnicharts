-- OmniCharts D1 schema v1 (see docs/06-storage-and-rollup-design.md)

CREATE TABLE platforms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL
);

CREATE TABLE channels (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id),
  platform_channel_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  first_observed_at TEXT NOT NULL,
  last_seen_at TEXT,
  ingest_state TEXT NOT NULL DEFAULT 'discovered',
  UNIQUE(platform_id, platform_channel_id),
  UNIQUE(platform_id, slug)
);

CREATE TABLE game_categories (
  id TEXT PRIMARY KEY,
  platform_id TEXT NOT NULL REFERENCES platforms(id),
  platform_category_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  UNIQUE(platform_id, platform_category_id)
);

CREATE TABLE stream_sessions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  platform_stream_id TEXT NOT NULL,
  title TEXT,
  game_category_id TEXT REFERENCES game_categories(id),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  UNIQUE(channel_id, platform_stream_id)
);

CREATE TABLE viewer_samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_session_id TEXT NOT NULL REFERENCES stream_sessions(id),
  sampled_at TEXT NOT NULL,
  viewer_count INTEGER NOT NULL,
  UNIQUE(stream_session_id, sampled_at)
);

CREATE TABLE channel_daily_rollups (
  channel_id TEXT NOT NULL REFERENCES channels(id),
  date TEXT NOT NULL,
  hours_watched REAL NOT NULL,
  average_viewers REAL NOT NULL,
  peak_viewers INTEGER NOT NULL,
  airtime_minutes INTEGER NOT NULL,
  stream_count INTEGER NOT NULL,
  followers_delta INTEGER,
  PRIMARY KEY (channel_id, date)
);

CREATE TABLE game_daily_rollups (
  game_category_id TEXT NOT NULL REFERENCES game_categories(id),
  date TEXT NOT NULL,
  hours_watched REAL NOT NULL,
  average_viewers REAL NOT NULL,
  peak_viewers INTEGER NOT NULL,
  airtime_minutes INTEGER NOT NULL,
  live_channels INTEGER NOT NULL,
  PRIMARY KEY (game_category_id, date)
);

CREATE TABLE slug_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL REFERENCES channels(id),
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  platform_id TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  UNIQUE(platform_id, old_slug)
);

CREATE INDEX idx_channel_rollups_date_hw ON channel_daily_rollups(date, hours_watched DESC);
CREATE INDEX idx_game_rollups_date_av ON game_daily_rollups(date, average_viewers DESC);
CREATE INDEX idx_slug_history_lookup ON slug_history(platform_id, old_slug);

INSERT INTO platforms (id, slug, display_name) VALUES
  ('twitch', 'twitch', 'Twitch'),
  ('kick', 'kick', 'Kick'),
  ('youtube', 'youtube', 'YouTube');
