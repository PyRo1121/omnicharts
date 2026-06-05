-- Twitch EventSub subscription registry (docs/adr/0002-twitch-eventsub-vs-polling.md)

CREATE TABLE twitch_eventsub_subscriptions (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  broadcaster_user_id TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (broadcaster_user_id, event_type)
);

CREATE INDEX idx_twitch_eventsub_broadcaster ON twitch_eventsub_subscriptions(broadcaster_user_id);
CREATE INDEX idx_twitch_eventsub_status ON twitch_eventsub_subscriptions(status);
