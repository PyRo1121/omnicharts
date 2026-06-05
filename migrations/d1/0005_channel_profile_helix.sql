-- Tier B: Helix GET /users + GET /channels → channels profile fields (docs/06, inventory Tier B)

ALTER TABLE channels ADD COLUMN description TEXT;
ALTER TABLE channels ADD COLUMN broadcaster_type TEXT;
ALTER TABLE channels ADD COLUMN platform_created_at TEXT;
ALTER TABLE channels ADD COLUMN channel_profile_json TEXT;
ALTER TABLE channels ADD COLUMN profile_enriched_at TEXT;
