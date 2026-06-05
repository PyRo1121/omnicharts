import { periodCoverageNote, type RankingPeriod } from '@omnicharts/domain';
import { getRollupCoverageDays } from '@omnicharts/rollup';
import { parseUiPeriod, type Period } from '$lib/ui/platform.svelte';

export async function resolvePeriodContext(
	raw: string | null,
	db?: D1Database | null
): Promise<{ period: Period; periodNote: string | null }> {
	const parsed = parseUiPeriod(raw);
	if (parsed.periodNote || !db) return parsed;

	const availableDays = await getRollupCoverageDays(db);
	const coverage = periodCoverageNote(parsed.period as RankingPeriod, availableDays);
	return { period: parsed.period, periodNote: coverage };
}
