-- Phase 4.6: Twitch VOD metadata backfill (docs/05, docs/06)

ALTER TABLE channels ADD COLUMN vod_backfilled_at TEXT;

ALTER TABLE stream_sessions ADD COLUMN backfill_source TEXT;
ALTER TABLE stream_sessions ADD COLUMN duration TEXT;
ALTER TABLE stream_sessions ADD COLUMN view_count INTEGER;

CREATE INDEX idx_channels_vod_backfill ON channels(platform_id, ingest_state, vod_backfilled_at);
