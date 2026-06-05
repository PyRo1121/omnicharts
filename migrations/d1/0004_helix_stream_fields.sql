-- Tier A: persist remaining Helix GET /streams fields (see docs/06, autoresearch twitch-stream-payload-inventory)

ALTER TABLE channels ADD COLUMN language TEXT;

ALTER TABLE stream_sessions ADD COLUMN language TEXT;
ALTER TABLE stream_sessions ADD COLUMN tags_json TEXT;
ALTER TABLE stream_sessions ADD COLUMN thumbnail_url TEXT;
ALTER TABLE stream_sessions ADD COLUMN stream_type TEXT;
