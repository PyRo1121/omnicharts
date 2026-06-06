import { periodCoverageNote, type RankingPeriod } from '@omnicharts/domain';
import { getRollupCoverageDays, type D1Database as RollupD1 } from '@omnicharts/rollup';
import { parseUiPeriod } from '$lib/ui/platform.svelte';

export async function resolvePeriodContext(
	raw: string | null,
	db?: RollupD1 | null,
): Promise<{ period: RankingPeriod; periodNote: string | null }> {
	const parsed = parseUiPeriod(raw);
	if (parsed.periodNote || !db) return parsed;

	const availableDays = await getRollupCoverageDays(db);
	const coverage = periodCoverageNote(parsed.period, availableDays);
	return { period: parsed.period, periodNote: coverage };
}
