import { ingestCoverageModeFromEnv } from './config';
import { runTwitchCoverageCycle } from './coverage';
import { enqueueTwitchPollShards } from './poll';
import { runTwitchLiveSweep } from './sweep';

/** Queue `poll_platform` handler — mode from INGEST_COVERAGE_MODE (default full). */
export async function runTwitchPollPlatform(env: Env): Promise<void> {
	switch (ingestCoverageModeFromEnv(env)) {
		case 'shards_only':
			await enqueueTwitchPollShards(env);
			break;
		case 'sweep_only':
			await runTwitchLiveSweep(env);
			break;
		case 'full':
			// Legacy single message: one Helix client + shared sweep/game-pass dedup.
			await runTwitchCoverageCycle(env);
			break;
	}
}

/** Inline full cycle — admin POST /admin/twitch/poll only (not queue). */
export { runTwitchCoverageCycle };
