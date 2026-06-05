import { describe, it, expect, vi, afterEach } from 'vitest';
import { enrichFollowersBeforeRollup } from '../src/twitch/enrich-profiles';
import * as enrich from '../src/twitch/enrich-profiles';
import * as credentials from '../src/twitch/credentials';

const DATE = '2026-05-30';

describe('enrichFollowersBeforeRollup', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('skips when Twitch app credentials missing', async () => {
		vi.spyOn(credentials, 'hasTwitchAppCredentials').mockReturnValue(false);
		const enrichSpy = vi.spyOn(enrich, 'runTwitchProfileEnrichment');

		await enrichFollowersBeforeRollup({ DB: {} as D1Database } as Env, DATE);

		expect(enrichSpy).not.toHaveBeenCalled();
	});
});
