import { minViewersFromEnv } from './config';
import { liveSweepMaxPagesFromEnv } from './helix-budget';
import { shouldContinueHelixPagination } from './helix-pagination';
import { TwitchHelixClient } from './helix';
import { helixBudgetAllowsFetch, helixBudgetPageCap } from './rate-limit';
import { ingestStreamPage, type StreamPageIngestStats } from './stream-page';
import type { IngestRunOpts } from '../db/d1-meta';

export type LiveSweepStats = StreamPageIngestStats & {
	pagesFetched: number;
	stoppedBecause: 'below_threshold' | 'end_of_catalog' | 'max_pages' | 'budget_exhausted';
};

/**
 * Global live directory sweep — no streamer allowlist.
 * Paginates GET /helix/streams (all live, by viewer count desc) until pages fall below minViewers.
 */
export type LiveSweepOptions = {
	/** Cap Helix pages — checkpoint quick poll uses a small sweep. */
	maxPages?: number;
	/** Shared client for sequential coverage (one budget across sweep + game pass + reconcile). */
	client?: TwitchHelixClient;
	/** Dedupe user_ids across sweep and game pass in the same cycle. */
	seenUserIds?: Set<string>;
	runOpts?: IngestRunOpts;
};

export async function runTwitchLiveSweep(env: Env, opts: LiveSweepOptions = {}): Promise<LiveSweepStats> {
	const client = opts.client ?? new TwitchHelixClient(env);
	const minViewers = minViewersFromEnv(env);
	const configuredPages = opts.maxPages ?? liveSweepMaxPagesFromEnv(env);
	const pageLimit = helixBudgetPageCap(client.getBudget(), configuredPages);
	const seenUserIds = opts.seenUserIds ?? new Set<string>();
	const stats: LiveSweepStats = {
		pagesFetched: 0,
		streamsSeen: 0,
		channelsIngested: 0,
		duplicatesSkipped: 0,
		stoppedBecause: 'end_of_catalog',
	};

	let cursor: string | undefined;
	let consecutiveEmptyPages = 0;

	if (pageLimit === 0) {
		stats.stoppedBecause = 'budget_exhausted';
		return stats;
	}

	for (let page = 0; page < pageLimit; page++) {
		if (!helixBudgetAllowsFetch(client.getBudget())) {
			stats.stoppedBecause = 'budget_exhausted';
			return stats;
		}

		const pageResult = await client.getLiveStreamsPage({
			first: 100,
			after: cursor,
		});
		stats.pagesFetched++;

		const streams = pageResult.data ?? [];
		if (streams.length === 0) {
			if (shouldContinueHelixPagination(streams, pageResult.pagination, consecutiveEmptyPages)) {
				consecutiveEmptyPages++;
				cursor = pageResult.pagination!.cursor;
				continue;
			}
			stats.stoppedBecause = 'end_of_catalog';
			return stats;
		}
		consecutiveEmptyPages = 0;

		const { pageMaxViewers } = await ingestStreamPage(env, streams, minViewers, seenUserIds, stats, opts.runOpts);

		if (pageMaxViewers < minViewers) {
			stats.stoppedBecause = 'below_threshold';
			return stats;
		}

		cursor = pageResult.pagination?.cursor;
		if (!cursor) {
			stats.stoppedBecause = 'end_of_catalog';
			return stats;
		}
	}

	stats.stoppedBecause = 'max_pages';
	return stats;
}
