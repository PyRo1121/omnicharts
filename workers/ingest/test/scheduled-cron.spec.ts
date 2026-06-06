import { describe, it, expect } from 'vitest';
import { testEnv } from './helpers';
import { cronToMessages, TWITCH_CRON } from '../src/cron-messages';

describe('scheduled cron enqueue (env wiring)', () => {
	it('passes production env so */1 enqueues sweep+reconcile coverage messages', () => {
		const env = testEnv({ INGEST_COVERAGE_MODE: 'full' });
		const messages = cronToMessages(TWITCH_CRON, env);
		expect(messages).toEqual([{ type: 'poll_twitch_coverage' }]);
	});

	it('without env falls back to legacy poll_platform (tests only)', () => {
		expect(cronToMessages(TWITCH_CRON)).toEqual([{ type: 'poll_platform', platform: 'twitch' }]);
	});
});
