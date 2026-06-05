import { parseRankingPeriod, type RankingPeriod } from '@omnicharts/domain';
import type { Period } from '$lib/ui/platform.svelte';

/** Map UI period selector values to API `period` query. */
export function periodForApi(period: Period): RankingPeriod {
	return parseRankingPeriod(period);
}
