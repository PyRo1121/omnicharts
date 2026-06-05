import { describe, it, expect, vi } from 'vitest';
import { testEnv } from './helpers';
import { TWITCH_COVERAGE_FANOUT_MESSAGES, enqueueTwitchCoverageFanout } from '../src/twitch/coverage-fanout';

describe('enqueueTwitchCoverageFanout', () => {
	it('sendBatch enqueues sweep+reconcile (game pass inline in sweep consumer)', async () => {
		const sendBatch = vi.fn().mockResolvedValue({ messages: [] });
		const env = testEnv({
			INGEST_QUEUE: { send: vi.fn(), sendBatch, metrics: vi.fn() },
		});

		const count = await enqueueTwitchCoverageFanout(env);

		expect(count).toBe(2);
		expect(sendBatch).toHaveBeenCalledOnce();
		expect(sendBatch.mock.calls[0][0]).toEqual(TWITCH_COVERAGE_FANOUT_MESSAGES.map((body) => ({ body })));
	});
});
