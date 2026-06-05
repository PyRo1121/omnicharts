import { describe, it, expect, vi, beforeEach } from 'vitest';
import { testEnv } from './helpers';
import { runTwitchPollPlatform } from '../src/twitch/poll-platform';

vi.mock('../src/twitch/poll', () => ({
	enqueueTwitchPollShards: vi.fn(),
}));
vi.mock('../src/twitch/sweep', () => ({
	runTwitchLiveSweep: vi.fn(),
}));
vi.mock('../src/twitch/coverage', () => ({
	runTwitchCoverageCycle: vi.fn(),
}));

import { enqueueTwitchPollShards } from '../src/twitch/poll';
import { runTwitchLiveSweep } from '../src/twitch/sweep';
import { runTwitchCoverageCycle } from '../src/twitch/coverage';

describe('runTwitchPollPlatform', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('runs full coverage inline when INGEST_COVERAGE_MODE=full (no double fan-out)', async () => {
		await runTwitchPollPlatform(testEnv({ INGEST_COVERAGE_MODE: 'full' }));
		expect(runTwitchCoverageCycle).toHaveBeenCalledOnce();
		expect(runTwitchLiveSweep).not.toHaveBeenCalled();
	});

	it('enqueues shards when INGEST_COVERAGE_MODE=shards_only', async () => {
		vi.mocked(enqueueTwitchPollShards).mockResolvedValue(1);
		await runTwitchPollPlatform(testEnv({ INGEST_COVERAGE_MODE: 'shards_only' }));
		expect(enqueueTwitchPollShards).toHaveBeenCalledOnce();
		expect(runTwitchLiveSweep).not.toHaveBeenCalled();
	});

	it('runs sweep only when INGEST_COVERAGE_MODE=sweep_only', async () => {
		await runTwitchPollPlatform(testEnv({ INGEST_COVERAGE_MODE: 'sweep_only' }));
		expect(runTwitchLiveSweep).toHaveBeenCalledOnce();
		expect(runTwitchCoverageCycle).not.toHaveBeenCalled();
	});
});
