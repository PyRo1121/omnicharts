/** Data/API platform identifiers — `platforms.id` in D1 (see migrations/d1/0001_init_schema.sql). */
export type PlatformId = 'twitch' | 'kick' | 'youtube';

/** Homepage / browse filter — includes aggregate "all platforms". */
export type UiPlatformFilter = PlatformId | 'all';

export const platformIds = ['twitch', 'kick', 'youtube'] as const satisfies readonly PlatformId[];

export const PLATFORM_TWITCH: PlatformId = 'twitch';
export const PLATFORM_KICK: PlatformId = 'kick';
export const PLATFORM_YOUTUBE: PlatformId = 'youtube';

export function isPlatformId(raw: string): raw is PlatformId {
	return (platformIds as readonly string[]).includes(raw);
}

export function parsePlatformId(raw: string | null, fallback: PlatformId = PLATFORM_TWITCH): PlatformId {
	if (raw && isPlatformId(raw)) return raw;
	return fallback;
}

export function isUiPlatformFilter(raw: string): raw is UiPlatformFilter {
	return raw === 'all' || isPlatformId(raw);
}
