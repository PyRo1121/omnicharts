import { ingestNonFatalError } from '../../log';
import { requireDb } from '../../worker-bindings';
import { isEventSubConfigured } from './env';
import { TwitchEventSubApi } from './subscriptions-api';
import { deleteEventSubSubscriptionsForBroadcaster, listEventSubSubscriptionsForBroadcaster } from './subscriptions-db';

/**
 * Delete Helix EventSub subs when a channel is retired (404 on Helix user).
 * Best-effort — logs and continues on API errors.
 */
export async function deleteEventSubForRetiredChannels(env: Env, platformChannelIds: string[]): Promise<number> {
	if (platformChannelIds.length === 0 || !isEventSubConfigured(env)) return 0;

	const db = requireDb(env);
	const api = new TwitchEventSubApi(env);
	let deleted = 0;

	for (const broadcasterUserId of platformChannelIds) {
		const subs = await listEventSubSubscriptionsForBroadcaster(db, broadcasterUserId);
		for (const sub of subs) {
			try {
				await api.deleteSubscription(sub.id);
				deleted++;
			} catch (err) {
				ingestNonFatalError(`EventSub delete ${sub.id}`, err);
			}
		}
		if (subs.length > 0) {
			await deleteEventSubSubscriptionsForBroadcaster(db, broadcasterUserId);
		}
	}

	return deleted;
}
