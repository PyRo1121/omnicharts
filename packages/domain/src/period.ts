/** Ranking windows — docs/07-api-spec.md, docs/13-testing-and-verification.md */
export type RankingPeriod = '24h' | '7d' | '30d' | '90d';

export const rankingPeriods = ['24h', '7d', '30d', '90d'] as const satisfies readonly RankingPeriod[];

/** Shown in UI period selectors — Phase 4 adds `90d`. */
export const uiRankingPeriods = ['24h', '7d', '30d', '90d'] as const satisfies readonly RankingPeriod[];

/** Two-channel compare — docs/28-phase4-plan slice 4.4 (no 24h). */
export const comparePeriods = ['7d', '30d', '90d'] as const satisfies readonly RankingPeriod[];
export type ComparePeriod = (typeof comparePeriods)[number];

export function isComparePeriod(raw: string): raw is ComparePeriod {
	return (comparePeriods as readonly string[]).includes(raw);
}

export function parseComparePeriod(raw: string | null): ComparePeriod {
	if (raw && isComparePeriod(raw)) return raw;
	return '7d';
}

export const DEFAULT_RANKING_PERIOD: RankingPeriod = '7d';

const ALLOWED: RankingPeriod[] = [...rankingPeriods];

export function isRankingPeriod(raw: string): raw is RankingPeriod {
	return (ALLOWED as readonly string[]).includes(raw);
}

export function parseRankingPeriod(raw: string | null): RankingPeriod {
	if (raw && isRankingPeriod(raw)) return raw;
	return DEFAULT_RANKING_PERIOD;
}

export function periodToDays(period: RankingPeriod): number {
	switch (period) {
		case '24h':
			return 1;
		case '7d':
			return 7;
		case '30d':
			return 30;
		case '90d':
			return 90;
		default: {
			const exhaustiveCheck: never = period;
			return exhaustiveCheck;
		}
	}
}

/** Honest UI note when rollup history is shorter than the selected ranking window. */
export function periodCoverageNote(period: RankingPeriod, availableRollupDays: number | null): string | null {
	if (availableRollupDays == null || availableRollupDays <= 0) return null;
	const requested = periodToDays(period);
	if (availableRollupDays >= requested) return null;
	const label = availableRollupDays === 1 ? 'day' : 'days';
	return `Only ${availableRollupDays} ${label} of rollup history available — metrics cover tracked days in the selected window.`;
}
