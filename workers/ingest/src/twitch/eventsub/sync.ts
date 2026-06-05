import { eventsubSyncMaxChannelsFromEnv, maxTrackedFromEnv } from '../config';
import { ingestWarn } from '../../log';
import { requireDb } from '../../worker-bindings';
import { eventSubConfigError, isEventSubConfigured } from './env';
import { getEventSubSyncCursor, setEventSubSyncCursor } from './sync-cursor';
import {
	listEventSubSubscriptionsForBroadcaster,
	listTrackedBroadcasterIds,
	upsertEventSubSubscription
} from './subscriptions-db';
import { TwitchEventSubApi } from './subscriptions-api';
import type { EventSubSubscriptionType, HelixEventSubSubscription } from './types';

const LIFECYCLE_TYPES: EventSubSubscriptionType[] = ['stream.online', 'stream.offline'];

export type EventSubSyncStats = {
	trackedChannels: number;
	existingRemote: number;
	created: number;
	skippedExisting: number;
	errors: number;
	errorSamples: string[];
};

async function upsertRemoteSubscription(
	db: D1Database,
	sub: HelixEventSubSubscription,
	eventType: EventSubSubscriptionType,
	broadcasterUserId: string
): Promise<void> {
	await upsertEventSubSubscription(db, {
		id: sub.id,
		eventType,
		broadcasterUserId,
		status: sub.status
	});
}

/**
 * Ensure stream.online + stream.offline webhook subs for tracked channels.
 * @see https://dev.twitch.tv/docs/eventsub/manage-subscriptions/
 */
export async function syncTwitchEventSubSubscriptions(env: Env): Promise<EventSubSyncStats> {
	const stats: EventSubSyncStats = {
		trackedChannels: 0,
		existingRemote: 0,
		created: 0,
		skippedExisting: 0,
		errors: 0,
		errorSamples: []
	};

	if (!isEventSubConfigured(env)) {
		stats.errorSamples.push(eventSubConfigError(env));
		stats.errors = 1;
		return stats;
	}

	const db = requireDb(env);
	const api = new TwitchEventSubApi(env);
	const maxCreatesPerRun = eventsubSyncMaxChannelsFromEnv(env);
	const broadcasterIds = await listTrackedBroadcasterIds(db, maxTrackedFromEnv(env));
	stats.trackedChannels = broadcasterIds.length;

	if (broadcasterIds.length === 0) {
		await setEventSubSyncCursor(db, 0);
		return stats;
	}

	let remote: HelixEventSubSubscription[] = [];
	try {
		remote = await api.listAllEnabled();
		stats.existingRemote = remote.length;
	} catch (err) {
		stats.errors = 1;
		const msg = err instanceof Error ? err.message : String(err);
		stats.errorSamples.push(`listAllEnabled: ${msg.slice(0, 300)}`);
		ingestWarn('EventSub sync listAllEnabled failed', stats);
		return stats;
	}

	const remoteKeys = new Set(
		remote.map((s) => `${s.type}:${s.condition.broadcaster_user_id}`)
	);

	const cursor = await getEventSubSyncCursor(db);
	let createsBudgetUsed = 0;
	let examined = 0;
	let pos = cursor % broadcasterIds.length;

	while (examined < broadcasterIds.length && createsBudgetUsed < maxCreatesPerRun) {
		const broadcasterUserId = broadcasterIds[pos]!;
		const needsAny = LIFECYCLE_TYPES.some(
			(type) => !remoteKeys.has(`${type}:${broadcasterUserId}`)
		);

		if (!needsAny) {
			const local = await listEventSubSubscriptionsForBroadcaster(db, broadcasterUserId);
			const localTypes = new Set(local.map((row) => row.eventType));
			if (localTypes.size === 0) {
				for (const type of LIFECYCLE_TYPES) {
					const sub = remote.find(
						(s) => s.type === type && s.condition.broadcaster_user_id === broadcasterUserId
					);
					if (sub) {
						await upsertRemoteSubscription(db, sub, type, broadcasterUserId);
						stats.skippedExisting++;
					}
				}
			}
		} else {
			createsBudgetUsed++;

			for (const type of LIFECYCLE_TYPES) {
				const key = `${type}:${broadcasterUserId}`;
				if (remoteKeys.has(key)) {
					const sub = remote.find(
						(s) => s.type === type && s.condition.broadcaster_user_id === broadcasterUserId
					);
					if (sub) {
						await upsertRemoteSubscription(db, sub, type, broadcasterUserId);
					}
					stats.skippedExisting++;
					continue;
				}

				const result = await api.createSubscription({
					type,
					broadcasterUserId,
					callbackUrl: env.TWITCH_EVENTSUB_CALLBACK_URL,
					secret: env.TWITCH_EVENTSUB_SECRET
				});

				if (result.subscriptionId) {
					await upsertEventSubSubscription(db, {
						id: result.subscriptionId,
						eventType: type,
						broadcasterUserId,
						status: result.status
					});
					stats.created++;
					remoteKeys.add(key);
				} else if (result.status === 'already_exists') {
					const sub = await api.findEnabledSubscription(type, broadcasterUserId);
					if (sub) {
						await upsertRemoteSubscription(db, sub, type, broadcasterUserId);
						remoteKeys.add(key);
						stats.skippedExisting++;
					} else {
						stats.errors++;
						if (stats.errorSamples.length < 5) {
							stats.errorSamples.push(
								`${type}@${broadcasterUserId}: already_exists but not found via list`
							);
						}
					}
				} else {
					stats.errors++;
					if (stats.errorSamples.length < 5 && result.error) {
						stats.errorSamples.push(`${type}@${broadcasterUserId}: ${result.error}`);
					}
				}
			}
		}

		examined++;
		pos = (pos + 1) % broadcasterIds.length;
	}

	await setEventSubSyncCursor(db, pos);

	if (stats.errors > 0) {
		ingestWarn('EventSub sync completed with errors', stats);
	}

	return stats;
}
