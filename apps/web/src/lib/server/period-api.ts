import { parseRankingPeriod, type RankingPeriod } from '@omnicharts/domain';

/** Map UI period selector values to API `period` query. */
export function periodForApi(period: RankingPeriod): RankingPeriod {
	return parseRankingPeriod(period);
}
