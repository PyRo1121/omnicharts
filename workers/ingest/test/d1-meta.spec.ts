import { describe, expect, it } from 'vitest';
import {
	createD1PollCycle,
	emptyD1MetaTotals,
	finishD1PollCycle,
	logD1BatchScope,
	logD1Meta,
	metaFromD1Result,
	recordD1PollCycle,
	sumD1Results,
	withIngestRunOpts,
} from '../src/db/d1-meta';
import { testEnv } from './helpers';

describe('d1-meta', () => {
	it('sums rows_written from batch results', () => {
		const totals = sumD1Results([{ meta: { rows_read: 10, rows_written: 3 } }, { meta: { rows_read: 0, rows_written: 7 } }]);
		expect(totals).toEqual({ rows_read: 10, rows_written: 10, statements: 2 });
	});

	it('sumD1Results returns empty totals for null or empty input', () => {
		expect(sumD1Results(null)).toEqual(emptyD1MetaTotals());
		expect(sumD1Results([])).toEqual(emptyD1MetaTotals());
	});

	it('metaFromD1Result defaults missing meta to zero', () => {
		expect(metaFromD1Result({})).toEqual({ rows_read: 0, rows_written: 0, statements: 1 });
	});

	it('metaFromD1Result falls back to changes when rows_written absent (local D1)', () => {
		expect(metaFromD1Result({ meta: { changes: 4 } })).toEqual({ rows_read: 0, rows_written: 4, statements: 1 });
	});

	it('recordD1PollCycle no-ops when accumulator missing', () => {
		recordD1PollCycle(undefined, { rows_read: 1, rows_written: 1, statements: 1 });
	});

	it('poll cycle accumulator returns totals on finish', () => {
		const pollCycle = createD1PollCycle();
		recordD1PollCycle(pollCycle, { rows_read: 2, rows_written: 40, statements: 5 });
		const totals = finishD1PollCycle(pollCycle, 'poll_twitch_sweep', testEnv({ ENVIRONMENT: 'production' }));
		expect(totals).toEqual({ rows_read: 2, rows_written: 40, statements: 5 });
	});

	it('finishD1PollCycle returns null without accumulator', () => {
		expect(finishD1PollCycle(undefined, 'poll_twitch_sweep', testEnv())).toBeNull();
	});

	it('withIngestRunOpts merges poll cycle into batch opts', () => {
		const pollCycle = createD1PollCycle();
		const env = testEnv();
		expect(withIngestRunOpts(undefined, { pollCycle })).toEqual({ pollCycle });
		expect(withIngestRunOpts({ env, scope: 'channels' }, undefined)).toEqual({ env, scope: 'channels' });
		expect(withIngestRunOpts({ env, scope: 'channels' }, { pollCycle })).toEqual({
			env,
			scope: 'channels',
			pollCycle,
		});
	});

	it('logD1Meta and logD1BatchScope record poll cycle without env', () => {
		const pollCycle = createD1PollCycle();
		logD1Meta('samples', { meta: { rows_written: 3 } }, { pollCycle });
		logD1BatchScope('channels', { rows_read: 1, rows_written: 2, statements: 1 }, { pollCycle });
		expect(pollCycle.totals).toEqual({ rows_read: 1, rows_written: 5, statements: 2 });
	});
});
