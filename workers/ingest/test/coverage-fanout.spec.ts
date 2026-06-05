import { describe, it, expect, vi } from 'vitest';
import { TWITCH_COVERAGE_FANOUT_MESSAGES, enqueueTwitchCoverageFanout } from '../src/twitch/coverage-fanout';

describe('enqueueTwitchCoverageFanout', () => {
	it('sendBatch enqueues sweep+reconcile (game pass inline in sweep consumer)', async () => {
		const sendBatch = vi.fn().mockResolvedValue({ messages: [] });
		const env = { INGEST_QUEUE: { sendBatch } } as unknown as Env;

		const count = await enqueueTwitchCoverageFanout(env);

		expect(count).toBe(2);
		expect(sendBatch).toHaveBeenCalledOnce();
		expect(sendBatch.mock.calls[0][0]).toEqual(TWITCH_COVERAGE_FANOUT_MESSAGES.map((body) => ({ body })));
	});
});
