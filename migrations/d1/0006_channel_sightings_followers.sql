-- Live promotion (≥2 sightings in 14d) + public follower total from Helix GET /channels/followers

CREATE TABLE channel_live_sightings (
  channel_id TEXT NOT NULL REFERENCES channels(id),
  sighted_at TEXT NOT NULL,
  viewer_count INTEGER NOT NULL,
  PRIMARY KEY (channel_id, sighted_at)
);

CREATE INDEX idx_channel_live_sightings_channel_time
  ON channel_live_sightings(channel_id, sighted_at DESC);

ALTER TABLE channels ADD COLUMN follower_count INTEGER;
ALTER TABLE channels ADD COLUMN followers_enriched_at TEXT;
