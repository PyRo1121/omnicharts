/** Remove local dev-seed ranking rows so live Helix checkpoint is not polluted. */
export async function clearDevSeedChannels(db: D1Database): Promise<{ channelsDeleted: number }> {
	const { results } = await db
		.prepare(
			`SELECT id FROM channels
       WHERE id LIKE 'dev-seed-ch-%' OR platform_channel_id LIKE 'dev-%'`,
		)
		.all<{ id: string }>();

	const ids = (results ?? []).map((r) => r.id);
	if (ids.length === 0) return { channelsDeleted: 0 };

	for (const channelId of ids) {
		await db
			.prepare(`DELETE FROM viewer_samples WHERE stream_session_id IN (
         SELECT id FROM stream_sessions WHERE channel_id = ?)`)
			.bind(channelId)
			.run();
		await db.prepare(`DELETE FROM stream_sessions WHERE channel_id = ?`).bind(channelId).run();
		await db.prepare(`DELETE FROM channel_live_sightings WHERE channel_id = ?`).bind(channelId).run();
		await db.prepare(`DELETE FROM channel_daily_rollups WHERE channel_id = ?`).bind(channelId).run();
		await db.prepare(`DELETE FROM slug_history WHERE channel_id = ?`).bind(channelId).run();
		await db.prepare(`DELETE FROM channels WHERE id = ?`).bind(channelId).run();
	}

	return { channelsDeleted: ids.length };
}
