-- Phase 1: rollup bookkeeping + channel search indexes (docs/14, docs/16)

CREATE TABLE ingest_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX idx_channels_platform_slug ON channels(platform_id, slug);
CREATE INDEX idx_channels_platform_display ON channels(platform_id, display_name);
