-- Lane 3 ingest audit: poll lists, open sessions, rollup sample scans
-- docs/audits/ingest-d1-query-audit.md

CREATE INDEX IF NOT EXISTS idx_channels_platform_state_seen
  ON channels(platform_id, ingest_state, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_stream_sessions_channel_open
  ON stream_sessions(channel_id, started_at DESC)
  WHERE ended_at IS NULL;
