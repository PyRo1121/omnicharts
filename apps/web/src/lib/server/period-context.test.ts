import { describe, it, expect, vi } from 'vitest';
import * as rollup from '@omnicharts/rollup';
import { resolvePeriodContext } from './period-context';

describe('resolvePeriodContext', () => {
	it('returns coverage note when rollup history is shorter than 90d', async () => {
		vi.spyOn(rollup, 'getRollupCoverageDays').mockResolvedValue(12);
		const db = {} as D1Database;

		const result = await resolvePeriodContext('90d', db);
		expect(result.period).toBe('90d');
		expect(result.periodNote).toContain('12 days');

		vi.restoreAllMocks();
	});

	it('skips coverage lookup without D1', async () => {
		const result = await resolvePeriodContext('90d', null);
		expect(result).toEqual({ period: '90d', periodNote: null });
	});
});
