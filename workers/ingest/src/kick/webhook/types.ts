/** Kick Events API webhook payloads — docs.kick.com/events/event-types */

export type KickWebhookBroadcaster = {
	user_id: number;
	username?: string;
	channel_slug: string;
	is_anonymous?: boolean;
	is_verified?: boolean;
	profile_picture?: string;
	identity?: unknown;
};

export type KickLivestreamStatusUpdatedEvent = {
	broadcaster: KickWebhookBroadcaster;
	is_live: boolean;
	title?: string;
	started_at?: string;
	ended_at?: string | null;
};

export type KickWebhookHeaders = {
	messageId: string;
	subscriptionId: string;
	signature: string;
	messageTimestamp: string;
	eventType: string;
	eventVersion: string;
};
