import { applyStreamOffline, applyStreamOnline } from './lifecycle';
import { isDuplicateEventSubMessage, recordEventSubMessageId } from './message-dedup';
import { markEventSubRevoked } from './subscriptions-db';
import type { EventSubWebhookBody, StreamOfflineEvent, StreamOnlineEvent } from './types';
import { ingestWarn } from '../../log';
import { isEventSubTimestampFresh, verifyTwitchEventSubSignature } from './verify';
import { requireDb } from '../../worker-bindings';

const MESSAGE_TYPE = 'twitch-eventsub-message-type';
const MESSAGE_ID = 'twitch-eventsub-message-id';
const MESSAGE_TIMESTAMP = 'twitch-eventsub-message-timestamp';
const MESSAGE_SIGNATURE = 'twitch-eventsub-message-signature';

function parseStreamOnline(event: Record<string, unknown>): StreamOnlineEvent | null {
	if (typeof event.id !== 'string') return null;
	if (typeof event.broadcaster_user_id !== 'string') return null;
	if (typeof event.broadcaster_user_login !== 'string') return null;
	if (typeof event.broadcaster_user_name !== 'string') return null;
	if (typeof event.started_at !== 'string') return null;
	return event as StreamOnlineEvent;
}

function parseStreamOffline(event: Record<string, unknown>): StreamOfflineEvent | null {
	if (typeof event.broadcaster_user_id !== 'string') return null;
	if (typeof event.broadcaster_user_login !== 'string') return null;
	if (typeof event.broadcaster_user_name !== 'string') return null;
	const offline: StreamOfflineEvent = {
		broadcaster_user_id: event.broadcaster_user_id,
		broadcaster_user_login: event.broadcaster_user_login,
		broadcaster_user_name: event.broadcaster_user_name,
	};
	if (typeof event.ended_at === 'string') offline.ended_at = event.ended_at;
	return offline;
}

async function handleNotification(env: Env, body: EventSubWebhookBody, messageTimestamp?: string): Promise<void> {
	const subType = body.subscription?.type;
	const event = body.event;
	if (!subType || !event) {
		ingestWarn('EventSub notification dropped: missing subscription type or event', subType);
		return;
	}

	switch (subType) {
		case 'stream.online': {
			const parsed = parseStreamOnline(event);
			if (parsed) {
				await applyStreamOnline(env, parsed);
			} else {
				ingestWarn('EventSub notification dropped: malformed stream.online', event);
			}
			break;
		}
		case 'stream.offline': {
			const parsed = parseStreamOffline(event);
			if (parsed) {
				await applyStreamOffline(env, parsed, { endedAt: messageTimestamp });
			} else {
				ingestWarn('EventSub notification dropped: malformed stream.offline', event);
			}
			break;
		}
		default:
			ingestWarn('EventSub notification dropped: unsupported subscription type', subType);
			break;
	}
}

function deferEventSubWork(ctx: ExecutionContext | undefined, work: Promise<void>): Promise<void> | void {
	if (ctx) {
		ctx.waitUntil(work);
		return;
	}
	return work;
}

/**
 * POST /webhooks/twitch/eventsub
 * @see https://dev.twitch.tv/docs/eventsub/handling-webhook-events/
 */
export async function handleTwitchEventSubWebhook(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
	const secret = env.TWITCH_EVENTSUB_SECRET;
	if (!secret) {
		return new Response('EventSub webhook secret not configured', { status: 503 });
	}

	const messageType = request.headers.get(MESSAGE_TYPE);
	const messageId = request.headers.get(MESSAGE_ID);
	const timestamp = request.headers.get(MESSAGE_TIMESTAMP);
	const signature = request.headers.get(MESSAGE_SIGNATURE);

	if (!messageType || !messageId || !timestamp || !signature) {
		return new Response('Missing EventSub headers', { status: 400 });
	}

	const rawBody = await request.text();

	if (!isEventSubTimestampFresh(timestamp)) {
		return new Response('Stale EventSub timestamp', { status: 403 });
	}

	const valid = await verifyTwitchEventSubSignature({
		secret,
		messageId,
		timestamp,
		signatureHeader: signature,
		rawBody,
	});

	if (!valid) {
		return new Response('Invalid EventSub signature', { status: 403 });
	}

	let body: EventSubWebhookBody;
	try {
		body = JSON.parse(rawBody) as EventSubWebhookBody;
	} catch {
		return new Response('Invalid JSON body', { status: 400 });
	}

	const db = requireDb(env);

	switch (messageType) {
		case 'webhook_callback_verification': {
			const challenge = body.challenge ?? '';
			return new Response(challenge, {
				status: 200,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}
		case 'revocation': {
			if (await isDuplicateEventSubMessage(db, messageId)) {
				return new Response(null, { status: 204 });
			}
			const subId = body.subscription?.id;
			const status = body.subscription?.status ?? 'revoked';
			const work = (async () => {
				if (subId) await markEventSubRevoked(db, subId, status);
				await recordEventSubMessageId(db, messageId);
				ingestWarn('EventSub revocation', subId, status);
			})();
			const pending = deferEventSubWork(ctx, work);
			if (pending) await pending;
			return new Response(null, { status: 204 });
		}
		case 'notification': {
			if (await isDuplicateEventSubMessage(db, messageId)) {
				return new Response(null, { status: 204 });
			}
			const work = (async () => {
				await handleNotification(env, body, timestamp);
				await recordEventSubMessageId(db, messageId);
			})();
			const pending = deferEventSubWork(ctx, work);
			if (pending) await pending;
			return new Response(null, { status: 204 });
		}
		default:
			return new Response(null, { status: 204 });
	}
}
