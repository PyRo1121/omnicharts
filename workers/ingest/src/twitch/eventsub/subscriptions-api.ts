import { getAppAccessToken } from '../auth';
import { HelixRateBudget } from '../rate-limit';
import type { CreateSubscriptionResult, EventSubSubscriptionType, HelixEventSubSubscription } from './types';

type HelixEventSubListResponse = {
	data: HelixEventSubSubscription[];
	pagination?: { cursor?: string };
	total: number;
	total_cost: number;
	max_total_cost: number;
};

type HelixEventSubCreateResponse = {
	data: HelixEventSubSubscription[];
	total: number;
	total_cost: number;
	max_total_cost: number;
};

/**
 * Helix EventSub subscription management.
 * @see https://dev.twitch.tv/docs/eventsub/manage-subscriptions/
 */
export class TwitchEventSubApi {
	constructor(
		private readonly env: Env,
		private readonly budget = new HelixRateBudget(),
	) {}

	async listSubscriptions(
		opts: {
			status?: 'enabled' | 'webhook_callback_verification_pending';
			type?: EventSubSubscriptionType;
			userId?: string;
			after?: string;
		} = {},
	): Promise<HelixEventSubListResponse> {
		const token = await getAppAccessToken(this.env, this.budget);
		await this.budget.consume(1);

		const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
		if (opts.status) url.searchParams.set('status', opts.status);
		if (opts.type) url.searchParams.set('type', opts.type);
		if (opts.userId) url.searchParams.set('user_id', opts.userId);
		if (opts.after) url.searchParams.set('after', opts.after);

		const res = await fetch(url, {
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': this.env.TWITCH_CLIENT_ID!,
			},
		});

		if (!res.ok) {
			const text = await res.text();
			throw new Error(`EventSub list ${res.status}: ${text.slice(0, 300)}`);
		}

		return (await res.json()) as HelixEventSubListResponse;
	}

	async listAllEnabled(): Promise<HelixEventSubSubscription[]> {
		const out: HelixEventSubSubscription[] = [];
		let after: string | undefined;
		do {
			const page = await this.listSubscriptions({ status: 'enabled', after });
			out.push(...(page.data ?? []));
			after = page.pagination?.cursor;
		} while (after);
		return out;
	}

	async findEnabledSubscription(type: EventSubSubscriptionType, broadcasterUserId: string): Promise<HelixEventSubSubscription | null> {
		const page = await this.listSubscriptions({
			status: 'enabled',
			type,
			userId: broadcasterUserId,
		});
		return page.data?.find((s) => s.type === type && s.condition.broadcaster_user_id === broadcasterUserId) ?? page.data?.[0] ?? null;
	}

	async createSubscription(opts: {
		type: EventSubSubscriptionType;
		broadcasterUserId: string;
		callbackUrl: string;
		secret: string;
	}): Promise<CreateSubscriptionResult> {
		const token = await getAppAccessToken(this.env, this.budget);
		await this.budget.consume(1);

		const body = {
			type: opts.type,
			version: '1',
			condition: { broadcaster_user_id: opts.broadcasterUserId },
			transport: {
				method: 'webhook',
				callback: opts.callbackUrl,
				secret: opts.secret,
			},
		};

		const res = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': this.env.TWITCH_CLIENT_ID!,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		});

		const text = await res.text();
		let json: HelixEventSubCreateResponse | { message?: string; error?: string } = {};
		try {
			json = JSON.parse(text) as HelixEventSubCreateResponse;
		} catch {
			/* non-json */
		}

		if (res.status === 409) {
			return {
				subscriptionId: null,
				status: 'already_exists',
				error: text.slice(0, 200),
			};
		}

		if (!res.ok) {
			return {
				subscriptionId: null,
				status: 'error',
				error: `${res.status}: ${text.slice(0, 300)}`,
			};
		}

		const sub = (json as HelixEventSubCreateResponse).data?.[0];
		return {
			subscriptionId: sub?.id ?? null,
			status: sub?.status ?? 'unknown',
		};
	}

	async deleteSubscription(subscriptionId: string): Promise<void> {
		const token = await getAppAccessToken(this.env, this.budget);
		await this.budget.consume(1);

		const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
		url.searchParams.set('id', subscriptionId);

		const res = await fetch(url, {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${token}`,
				'Client-Id': this.env.TWITCH_CLIENT_ID!,
			},
		});

		if (!res.ok && res.status !== 404) {
			const text = await res.text();
			throw new Error(`EventSub delete ${res.status}: ${text.slice(0, 300)}`);
		}
	}
}
