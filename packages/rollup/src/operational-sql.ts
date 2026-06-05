import { INGEST_STATE_TRACKED } from '@omnicharts/domain';

/** Open sessions must have a sample within this window to count as "live now". */
export const LIVE_COUNT_RECENT_SAMPLE_MINUTES = 5;

export const TWITCH_LIVE_COUNT_SQL = `SELECT COUNT(DISTINCT ss.channel_id) AS n
       FROM stream_sessions ss
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE c.platform_id = ?
         AND ss.ended_at IS NULL
         AND EXISTS (
           SELECT 1 FROM viewer_samples vs
           WHERE vs.stream_session_id = ss.id
             AND vs.sampled_at >= datetime('now', '-${LIVE_COUNT_RECENT_SAMPLE_MINUTES} minutes')
         )`;

export const TWITCH_TRACKED_COUNT_SQL = `SELECT COUNT(*) AS n FROM channels
       WHERE platform_id = ? AND ingest_state = '${INGEST_STATE_TRACKED}'`;

export const TWITCH_DISCOVERY_24H_SQL = `SELECT COUNT(*) AS n FROM channels
       WHERE platform_id = ?
         AND first_observed_at >= datetime('now', '-1 day')`;

export const TWITCH_MAX_SAMPLE_SQL = `SELECT MAX(vs.sampled_at) AS max_sampled_at
       FROM viewer_samples vs
       INNER JOIN stream_sessions ss ON ss.id = vs.stream_session_id
       INNER JOIN channels c ON c.id = ss.channel_id
       WHERE c.platform_id = ?`;
