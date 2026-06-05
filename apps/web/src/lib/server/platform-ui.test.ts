import { describe, it, expect } from 'vitest';
import {
	channelRankingsEmptyMessage,
	parseUiPeriod,
	uiPeriods
} from '$lib/ui/platform.svelte';

describe('ui periods (Phase 4 slice 4.2)', () => {
	it('uiPeriods includes 90d', () => {
		expect(uiPeriods).toEqual(['24h', '7d', '30d', '90d']);
	});

	it('parseUiPeriod passes through 90d', () => {
		expect(parseUiPeriod('90d')).toEqual({ period: '90d', periodNote: null });
	});

	it('channelRankingsEmptyMessage mentions 90-day window', () => {
		const msg = channelRankingsEmptyMessage(false, 'live', '90d');
		expect(msg).toContain('90-day');
	});
});
