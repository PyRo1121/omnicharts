/** Ranking windows — docs/07-api-spec.md, docs/13-testing-and-verification.md */
export type RankingPeriod = '24h' | '7d' | '30d' | '90d';

export const rankingPeriods = ['24h', '7d', '30d', '90d'] as const satisfies readonly RankingPeriod[];

/** Shown in UI period selectors until Phase 4 retention (REM-022). */
export const uiRankingPeriods = ['24h', '7d', '30d'] as const satisfies readonly RankingPeriod[];

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
	}
}
