import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TwitchHelixClient } from '../src/twitch/helix';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const usersJson = readFileSync(join(fixtureDir, 'fixtures/helix-users-sample.json'), 'utf8');
const channelsJson = readFileSync(join(fixtureDir, 'fixtures/helix-channels-sample.json'), 'utf8');

vi.mock('../src/twitch/auth', () => ({
	getAppAccessToken: vi.fn().mockResolvedValue('test-token')
}));

describe('TwitchHelixClient users/channels batches', () => {
	const env = { TWITCH_CLIENT_ID: 'cid', TWITCH_CLIENT_SECRET: 'sec' } as Env;

	beforeEach(() => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockImplementation((input: RequestInfo | URL) => {
				const url = String(input);
				if (url.includes('/helix/users')) {
					return Promise.resolve(
						new Response(usersJson, {
							status: 200,
							headers: {
								'Ratelimit-Remaining': '799',
								'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60)
							}
						})
					);
				}
				if (url.includes('/helix/channels')) {
					return Promise.resolve(
						new Response(channelsJson, {
							status: 200,
							headers: {
								'Ratelimit-Remaining': '798',
								'Ratelimit-Reset': String(Math.floor(Date.now() / 1000) + 60)
							}
						})
					);
				}
				return Promise.resolve(new Response('{}', { status: 404 }));
			})
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('GET /users appends id query params', async () => {
		const client = new TwitchHelixClient(env);
		const users = await client.getUsersByIds(['545050196', '141981764']);
		expect(users).toHaveLength(2);
		expect(users[0]!.profile_image_url).toContain('jtvnw.net');

		const fetchMock = vi.mocked(fetch);
		const usersUrl = String(fetchMock.mock.calls[0]![0]);
		expect(usersUrl).toContain('id=545050196');
		expect(usersUrl).toContain('id=141981764');
	});

	it('GET /channels appends broadcaster_id query params', async () => {
		const client = new TwitchHelixClient(env);
		const channels = await client.getChannelsByBroadcasterIds(['545050196']);
		expect(channels[0]!.title).toBe('Offline channel title');
		expect(channels[0]!.tags).toContain('日本語');

		const fetchMock = vi.mocked(fetch);
		const chUrl = String(fetchMock.mock.calls[0]![0]);
		expect(chUrl).toContain('broadcaster_id=545050196');
	});

	it('GET /users appends login query params', async () => {
		const client = new TwitchHelixClient(env);
		const users = await client.getUsersByLogins(['shroud', 'ninja']);
		expect(users.length).toBeGreaterThan(0);

		const fetchMock = vi.mocked(fetch);
		const usersUrl = String(fetchMock.mock.calls[0]![0]);
		expect(usersUrl).toContain('login=shroud');
		expect(usersUrl).toContain('login=ninja');
	});
});
