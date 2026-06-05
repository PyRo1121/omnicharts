import type { EventSubSubscriptionType } from './types';

const nowIso = () => new Date().toISOString();

export async function upsertEventSubSubscription(
	db: D1Database,
	row: {
		id: string;
		eventType: EventSubSubscriptionType;
		broadcasterUserId: string;
		status: string;
	},
): Promise<void> {
	const now = nowIso();
	await db
		.prepare(
			`INSERT INTO twitch_eventsub_subscriptions (
         id, event_type, broadcaster_user_id, status, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(broadcaster_user_id, event_type) DO UPDATE SET
         id = excluded.id,
         status = excluded.status,
         updated_at = excluded.updated_at`,
		)
		.bind(row.id, row.eventType, row.broadcasterUserId, row.status, now, now)
		.run();
}

export async function markEventSubRevoked(db: D1Database, subscriptionId: string, status: string): Promise<void> {
	await db
		.prepare(
			`UPDATE twitch_eventsub_subscriptions
       SET status = ?, updated_at = ?
       WHERE id = ?`,
		)
		.bind(status, nowIso(), subscriptionId)
		.run();
}

export async function listEventSubSubscriptionsForBroadcaster(
	db: D1Database,
	broadcasterUserId: string,
): Promise<{ id: string; eventType: EventSubSubscriptionType }[]> {
	const { results } = await db
		.prepare(
			`SELECT id, event_type FROM twitch_eventsub_subscriptions
       WHERE broadcaster_user_id = ?`,
		)
		.bind(broadcasterUserId)
		.all<{ id: string; event_type: EventSubSubscriptionType }>();

	return (results ?? []).map((r) => ({ id: r.id, eventType: r.event_type }));
}

export async function deleteEventSubSubscriptionsForBroadcaster(db: D1Database, broadcasterUserId: string): Promise<void> {
	await db.prepare(`DELETE FROM twitch_eventsub_subscriptions WHERE broadcaster_user_id = ?`).bind(broadcasterUserId).run();
}

export async function listTrackedBroadcasterIds(db: D1Database, limit: number): Promise<string[]> {
	const { results } = await db
		.prepare(
			`SELECT platform_channel_id FROM channels
       WHERE platform_id = 'twitch' AND ingest_state = 'tracked'
       ORDER BY last_seen_at DESC NULLS LAST
       LIMIT ?`,
		)
		.bind(limit)
		.all<{ platform_channel_id: string }>();

	return (results ?? []).map((r) => r.platform_channel_id);
}
