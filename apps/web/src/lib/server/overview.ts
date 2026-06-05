import { getIngestBaseUrl } from '$lib/server/ingest';
import type { ServerLoadContext } from '$lib/server/load-context';
import { loadHomepageFromD1 } from '$lib/server/homepage-d1';
import { loadChannelRankings, type ChannelRankingsLoad } from '$lib/server/rankings';
import { loadGameRankings, type GameRankingsLoad } from '$lib/server/game-rankings';
import { heroStats, type RankingPeriod } from '$lib/mock/home';

export type OverviewSource = 'live' | 'mock' | 'unavailable';

export type OverviewStat = {
	label: string;
	value: string;
	hint: string;
	source: OverviewSource;
};

export type OverviewLoad = {
	source: OverviewSource;
	ingestStatus: string | null;
	stats: OverviewStat[];
	channelsLive: number | null;
	topChannelName: string | null;
	topGameName: string | null;
	/** Present when rankings were loaded with the same request (homepage dedupe). */
	channelRankings?: ChannelRankingsLoad;
	gameRankings?: GameRankingsLoad;
};

export type OverviewLoadOptions = {
	period?: RankingPeriod;
	channelLimit?: number;
	gameLimit?: number;
};

type IngestHealth = {
	status: string;
	tracked_channels: { twitch: number; kick: number; youtube: number };
	channels_live: number;
	channels_live_by_platform?: { twitch: number; kick: number; youtube: number };
	discovery_new_24h: number;
};

function formatCount(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return n.toLocaleString();
}

function unavailableOverviewStats(): OverviewStat[] {
	return [
		{
			label: 'Channels tracked',
			value: '—',
			hint: 'Start ingest and run discover for counts',
			source: 'unavailable',
		},
		{
			label: 'Live now',
			value: '—',
			hint: 'Requires ingest /health',
			source: 'unavailable',
		},
		{
			label: 'Top 20 ranked (7d)',
			value: '—',
			hint: 'Requires rollup-backed rankings',
			source: 'unavailable',
		},
	];
}

function rollupPlatformHealthUnavailableStats(): OverviewStat[] {
	return [
		{
			label: 'Channels tracked',
			value: '—',
			hint: 'Directory metrics ship with ingest health',
			source: 'unavailable',
		},
		{
			label: 'Live now',
			value: '—',
			hint: 'Requires platform ingest health',
			source: 'unavailable',
		},
	];
}

function overviewFromD1Snapshot(snapshot: Awaited<ReturnType<typeof loadHomepageFromD1>>): OverviewLoad {
	const { channelRankings, gameRankings } = snapshot;
	const stats: OverviewStat[] = [
		{
			label: 'Channels tracked',
			value: formatCount(snapshot.trackedChannels),
			hint: 'Twitch ingest state tracked',
			source: 'live',
		},
		{
			label: 'Live now',
			value: formatCount(snapshot.channelsLive),
			hint: 'From latest directory sweep',
			source: 'live',
		},
		{
			label: 'Top 20 ranked (7d)',
			value: String(channelRankings.rows.length),
			hint: 'Channels with rollup HW in period',
			source: channelRankings.source,
		},
	];

	return {
		source: 'live',
		ingestStatus: snapshot.status,
		stats,
		channelsLive: snapshot.channelsLive,
		topChannelName: channelRankings.rows[0]?.displayName ?? null,
		topGameName: gameRankings.rows[0]?.name ?? null,
		channelRankings,
		gameRankings,
	};
}

async function loadRollupPlatformOverview(
	ctx: ServerLoadContext,
	platform: 'kick' | 'youtube',
	mockEnabled = false,
	opts: OverviewLoadOptions = {},
): Promise<OverviewLoad> {
	const period = opts.period ?? '7d';
	const channelLimit = opts.channelLimit ?? 20;
	const gameLimit = opts.gameLimit ?? 1;

	const [channels, games] = await Promise.all([
		loadChannelRankings(ctx, platform, period, channelLimit, mockEnabled),
		loadGameRankings(ctx, platform, period, gameLimit, mockEnabled),
	]);

	const rankingsLive = channels.source === 'live' || games.source === 'live';
	const rankingsMock = channels.source === 'mock' || games.source === 'mock';
	const rankingsUnavailable = channels.source === 'unavailable' && games.source === 'unavailable';

	const rankedStat: OverviewStat = rankingsUnavailable
		? {
				label: 'Top 20 ranked (7d)',
				value: '—',
				hint: 'Requires rollup-backed rankings',
				source: 'unavailable',
			}
		: {
				label: 'Top 20 ranked (7d)',
				value: String(channels.rows.length),
				hint: 'Channels with rollup HW in period',
				source: channels.source,
			};

	let healthStats = rollupPlatformHealthUnavailableStats();
	let channelsLive: number | null = null;
	let ingestStatus: string | null = null;

	if (rankingsLive) {
		try {
			const healthRes = await ctx.fetch(`${getIngestBaseUrl()}/health`, {
				headers: { accept: 'application/json' },
			});
			if (healthRes.ok) {
				const health = (await healthRes.json()) as IngestHealth;
				const tracked = health.tracked_channels[platform];
				const live =
					health.channels_live_by_platform?.[platform] ?? (platform === 'kick' || platform === 'youtube' ? 0 : health.channels_live);
				healthStats = [
					{
						label: 'Channels tracked',
						value: formatCount(tracked),
						hint: `${platform === 'kick' ? 'Kick' : 'YouTube'} ingest state tracked`,
						source: 'live',
					},
					{
						label: 'Live now',
						value: formatCount(live),
						hint: 'From latest directory sweep',
						source: 'live',
					},
				];
				channelsLive = live;
				ingestStatus = health.status;
			}
		} catch {
			/* keep unavailable health stats */
		}
	}

	const stats: OverviewStat[] = [...healthStats, rankedStat];

	return {
		source: rankingsMock ? 'mock' : rankingsLive ? 'live' : 'unavailable',
		ingestStatus,
		stats,
		channelsLive,
		topChannelName: channels.rows[0]?.displayName ?? null,
		topGameName: games.rows[0]?.name ?? null,
		channelRankings: channels,
		gameRankings: games,
	};
}

export async function loadKickOverview(ctx: ServerLoadContext, mockEnabled = false, opts: OverviewLoadOptions = {}): Promise<OverviewLoad> {
	return loadRollupPlatformOverview(ctx, 'kick', mockEnabled, opts);
}

export async function loadYoutubeOverview(
	ctx: ServerLoadContext,
	mockEnabled = false,
	opts: OverviewLoadOptions = {},
): Promise<OverviewLoad> {
	return loadRollupPlatformOverview(ctx, 'youtube', mockEnabled, opts);
}

export async function loadOverview(ctx: ServerLoadContext, mockEnabled = false, opts: OverviewLoadOptions = {}): Promise<OverviewLoad> {
	const period = opts.period ?? '7d';
	const channelLimit = opts.channelLimit ?? 20;
	const gameLimit = opts.gameLimit ?? 1;
	const mockStats: OverviewStat[] = heroStats.map((s) => ({ ...s, source: 'mock' as const }));

	if (ctx.db) {
		try {
			const snapshot = await loadHomepageFromD1(ctx.db, period, channelLimit, gameLimit, ctx.cfEnv);
			return overviewFromD1Snapshot(snapshot);
		} catch {
			if (mockEnabled) {
				return {
					source: 'mock',
					ingestStatus: null,
					stats: mockStats,
					channelsLive: null,
					topChannelName: null,
					topGameName: null,
				};
			}
			return {
				source: 'unavailable',
				ingestStatus: null,
				stats: unavailableOverviewStats(),
				channelsLive: null,
				topChannelName: null,
				topGameName: null,
			};
		}
	}

	try {
		const healthRes = await ctx.fetch(`${getIngestBaseUrl()}/health`, {
			headers: { accept: 'application/json' },
		});
		if (!healthRes.ok) {
			if (mockEnabled) {
				return {
					source: 'mock',
					ingestStatus: null,
					stats: mockStats,
					channelsLive: null,
					topChannelName: null,
					topGameName: null,
				};
			}
			return {
				source: 'unavailable',
				ingestStatus: null,
				stats: unavailableOverviewStats(),
				channelsLive: null,
				topChannelName: null,
				topGameName: null,
			};
		}

		const health = (await healthRes.json()) as IngestHealth;
		const [channels, games] = await Promise.all([
			loadChannelRankings(ctx, 'twitch', period, channelLimit, mockEnabled),
			loadGameRankings(ctx, 'twitch', period, gameLimit, mockEnabled),
		]);

		const twitchLive = health.channels_live_by_platform?.twitch ?? health.channels_live;
		const stats: OverviewStat[] = [
			{
				label: 'Channels tracked',
				value: formatCount(health.tracked_channels.twitch),
				hint: 'Twitch ingest state tracked',
				source: 'live',
			},
			{
				label: 'Live now',
				value: formatCount(twitchLive),
				hint: 'From latest directory sweep',
				source: 'live',
			},
			{
				label: 'Top 20 ranked (7d)',
				value: String(channels.rows.length),
				hint: 'Channels with rollup HW in period',
				source: channels.source,
			},
		];

		return {
			source: 'live',
			ingestStatus: health.status,
			stats,
			channelsLive: twitchLive,
			topChannelName: channels.rows[0]?.displayName ?? null,
			topGameName: games.rows[0]?.name ?? null,
			channelRankings: channels,
			gameRankings: games,
		};
	} catch {
		if (mockEnabled) {
			return {
				source: 'mock',
				ingestStatus: null,
				stats: mockStats,
				channelsLive: null,
				topChannelName: null,
				topGameName: null,
			};
		}
		return {
			source: 'unavailable',
			ingestStatus: null,
			stats: unavailableOverviewStats(),
			channelsLive: null,
			topChannelName: null,
			topGameName: null,
		};
	}
}
