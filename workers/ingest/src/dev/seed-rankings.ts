/**
 * Local dev seed — 20 Twitch channels with 7d rollups for UI design / local demos.
 * Blocked when ENVIRONMENT=production unless ALLOW_DEV_SEED=1.
 * Prefer twitch:checkpoint (discover → poll → rollup) for verify pass.
 * Invoke: POST /admin/dev/seed-rankings (local wrangler only by default).
 */

import { requireDb } from '../worker-bindings';

export type SeedRankingsStats = {
	channels: number;
	rollupDays: number;
};

export async function seedDevRankings(env: Env): Promise<SeedRankingsStats> {
	const db = requireDb(env);
	const days = 7;
	const now = new Date();

	for (let rank = 1; rank <= 20; rank++) {
		const channelId = `dev-seed-ch-${rank}`;
		const slug = `dev_rank_${rank}`;
		const hwPerDay = (21 - rank) * 10;

		await db.prepare(
			`INSERT INTO channels (
         id, platform_id, platform_channel_id, slug, display_name,
         first_observed_at, ingest_state
       ) VALUES (?, 'twitch', ?, ?, ?, ?, 'tracked')
       ON CONFLICT(id) DO UPDATE SET
         slug = excluded.slug,
         display_name = excluded.display_name,
         ingest_state = 'tracked'`
		)
			.bind(
				channelId,
				`dev-${rank}`,
				slug,
				`Dev Rank ${rank}`,
				now.toISOString()
			)
			.run();

		for (let d = 0; d < days; d++) {
			const date = new Date(now);
			date.setUTCDate(date.getUTCDate() - d);
			const dateStr = date.toISOString().slice(0, 10);
			const hoursWatched = hwPerDay;
			const airtimeMinutes = 120;
			const averageViewers = hoursWatched / (airtimeMinutes / 60);

			await db.prepare(
				`INSERT INTO channel_daily_rollups (
           channel_id, date, hours_watched, average_viewers, peak_viewers,
           airtime_minutes, stream_count
         ) VALUES (?, ?, ?, ?, ?, ?, 1)
         ON CONFLICT(channel_id, date) DO UPDATE SET
           hours_watched = excluded.hours_watched,
           average_viewers = excluded.average_viewers,
           peak_viewers = excluded.peak_viewers,
           airtime_minutes = excluded.airtime_minutes,
           stream_count = excluded.stream_count`
			)
				.bind(
					channelId,
					dateStr,
					hoursWatched,
					averageViewers,
					Math.round(averageViewers * 1.5),
					airtimeMinutes
				)
				.run();
		}
	}

	await db.prepare(
		`INSERT INTO ingest_metadata (key, value) VALUES ('last_rollup_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	)
		.bind(now.toISOString())
		.run();

	return { channels: 20, rollupDays: days };
}
