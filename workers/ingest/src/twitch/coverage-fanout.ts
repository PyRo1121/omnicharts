import { TWITCH_COVERAGE_FANOUT_MESSAGES } from '../platform-coverage';
import { requireIngestQueue } from '../worker-bindings';

export { TWITCH_COVERAGE_FANOUT_MESSAGES };

export async function enqueueTwitchCoverageFanout(env: Env): Promise<number> {
	await requireIngestQueue(env).sendBatch(TWITCH_COVERAGE_FANOUT_MESSAGES.map((body) => ({ body })));
	return TWITCH_COVERAGE_FANOUT_MESSAGES.length;
}
