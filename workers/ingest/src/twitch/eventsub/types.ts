/** EventSub payloads — https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/ */

export type EventSubSubscriptionType = 'stream.online' | 'stream.offline';

export type EventSubWebhookBody = {
	subscription?: {
		id: string;
		type: string;
		status: string;
		condition?: { broadcaster_user_id?: string };
	};
	event?: Record<string, unknown>;
	challenge?: string;
};

export type StreamOnlineEvent = {
	id: string;
	broadcaster_user_id: string;
	broadcaster_user_login: string;
	broadcaster_user_name: string;
	type: string;
	started_at: string;
};

export type StreamOfflineEvent = {
	broadcaster_user_id: string;
	broadcaster_user_login: string;
	broadcaster_user_name: string;
	/** Present on some payloads; otherwise use webhook message timestamp. */
	ended_at?: string;
};

export type HelixEventSubSubscription = {
	id: string;
	type: string;
	version: string;
	status: string;
	cost: number;
	condition: { broadcaster_user_id: string };
	transport: { method: string; callback: string };
	created_at: string;
};

export type CreateSubscriptionResult = {
	subscriptionId: string | null;
	status: string;
	error?: string;
};
