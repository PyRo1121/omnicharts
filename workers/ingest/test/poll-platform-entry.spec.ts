import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runKickPollPlatform } from '../src/kick/poll-platform';
import { runYoutubePollPlatform } from '../src/youtube/poll-platform';
import * as kickPoll from '../src/kick/poll';
import * as youtubePoll from '../src/youtube/poll';

describe('platform poll entrypoints', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('runKickPollPlatform delegates to runKickCatalogPoll', async () => {
		const spy = vi.spyOn(kickPoll, 'runKickCatalogPoll').mockResolvedValue({
			batches: 0,
			skipped: 'NEEDS_API'
		});
		await runKickPollPlatform({} as Env);
		expect(spy).toHaveBeenCalledOnce();
	});

	it('runYoutubePollPlatform delegates to runYoutubeCatalogPoll', async () => {
		const spy = vi.spyOn(youtubePoll, 'runYoutubeCatalogPoll').mockResolvedValue({
			batches: 0,
			skipped: 'NEEDS_API'
		});
		await runYoutubePollPlatform({} as Env);
		expect(spy).toHaveBeenCalledOnce();
	});
});
