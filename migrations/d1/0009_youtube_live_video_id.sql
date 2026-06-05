-- YouTube tracked poll: persist known live broadcast video id per channel (docs/05)

ALTER TABLE channels ADD COLUMN youtube_live_video_id TEXT;
