/**
 * POST /webhooks/kick/events — livestream.status.updated lifecycle (ADR-003).
 * @see https://docs.kick.com/events/webhook-security
 */
import { ingestWarn } from '../../log';
import { requireDb } from '../../worker-bindings';
import {
	isDuplicateKickWebhookMessage,
	recordKickWebhookMessageId
} from './message-dedup';
import { applyKickLivestreamStatusUpdated, parseLivestreamStatusUpdated } from './lifecycle';
import type { KickWebhookHeaders } from './types';
import { verifyKickWebhookSignature } from './verify';

const HEADER_MESSAGE_ID = 'Kick-Event-Message-Id';
const HEADER_TIMESTAMP = 'Kick-Event-Message-Timestamp';
const HEADER_SIGNATURE = 'Kick-Event-Signature';
const HEADER_TYPE = 'Kick-Event-Type';
const HEADER_VERSION = 'Kick-Event-Version';
const HEADER_SUBSCRIPTION_ID = 'Kick-Event-Subscription-Id';

function parseKickWebhookHeaders(request: Request): KickWebhookHeaders | null {
	const messageId = request.headers.get(HEADER_MESSAGE_ID)?.trim();
	const signature = request.headers.get(HEADER_SIGNATURE)?.trim();
	const messageTimestamp = request.headers.get(HEADER_TIMESTAMP)?.trim();
	const eventType = request.headers.get(HEADER_TYPE)?.trim();
	const eventVersion = request.headers.get(HEADER_VERSION)?.trim();
	const subscriptionId = request.headers.get(HEADER_SUBSCRIPTION_ID)?.trim() ?? '';

	if (!messageId || !signature || !messageTimestamp || !eventType || !eventVersion) {
		return null;
	}

	return {
		messageId,
		subscriptionId,
		signature,
		messageTimestamp,
		eventType,
		eventVersion
	};
}

function kickWebhookPublicKey(env: Env): string | undefined {
	return env.KICK_WEBHOOK_PUBLIC_KEY?.trim();
}

export async function handleKickWebhook(
	request: Request,
	env: Env,
	ctx?: ExecutionContext
): Promise<Response> {
	const publicKeyPem = kickWebhookPublicKey(env);
	if (!publicKeyPem) {
		return new Response('Kick webhook public key not configured', { status: 503 });
	}

	const headers = parseKickWebhookHeaders(request);
	if (!headers) {
		return new Response('Missing Kick webhook headers', { status: 400 });
	}

	const rawBody = await request.text();
	const valid = await verifyKickWebhookSignature({
		publicKeyPem,
		messageId: headers.messageId,
		timestamp: headers.messageTimestamp,
		signatureHeader: headers.signature,
		rawBody
	});
	if (!valid) {
		return new Response('Invalid Kick webhook signature', { status: 401 });
	}

	const db = requireDb(env);
	if (await isDuplicateKickWebhookMessage(db, headers.messageId)) {
		return new Response(null, { status: 204 });
	}

	const work = (async () => {
		let parsedBody: unknown;
		try {
			parsedBody = JSON.parse(rawBody) as unknown;
		} catch {
			ingestWarn('[kick] webhook dropped: invalid JSON body');
			await recordKickWebhookMessageId(db, headers.messageId);
			return;
		}

		if (headers.eventType === 'livestream.status.updated' && headers.eventVersion === '1') {
			const event = parseLivestreamStatusUpdated(parsedBody);
			if (event) {
				await applyKickLivestreamStatusUpdated(env, event);
			} else {
				ingestWarn('[kick] webhook dropped: malformed livestream.status.updated', parsedBody);
			}
		} else {
			ingestWarn('[kick] webhook ignored: unsupported event', headers.eventType);
		}

		await recordKickWebhookMessageId(db, headers.messageId);
	})();

	if (ctx) {
		ctx.waitUntil(work);
	} else {
		await work;
	}

	return new Response(null, { status: 204 });
}
