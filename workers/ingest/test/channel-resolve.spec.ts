import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveChannelSlug } from '../src/ranking/channel-api';

describe('resolveChannelSlug', () => {
	const db = {
		prepare: vi.fn(),
	} as unknown as D1Database;

	beforeEach(() => {
		vi.resetAllMocks();
	});

	it('returns current slug when channel exists', async () => {
		const first = vi.fn().mockReturnValue({
			bind: vi.fn().mockReturnValue({
				first: vi.fn().mockResolvedValue({ slug: 'ninja' }),
			}),
		});
		(db.prepare as ReturnType<typeof vi.fn>).mockImplementation(first);

		const res = await resolveChannelSlug(db, { platform: 'twitch', slug: 'ninja' });
		expect(res).toEqual({ slug: 'ninja', from_history: false });
	});

	it('returns new_slug from slug_history when channel missing', async () => {
		let call = 0;
		(db.prepare as ReturnType<typeof vi.fn>).mockImplementation(() => {
			call += 1;
			return {
				bind: vi.fn().mockReturnValue({
					first: vi.fn().mockImplementation(async () => {
						if (call === 1) return null;
						return { new_slug: 'newname' };
					}),
				}),
			} as ReturnType<D1Database['prepare']>;
		});

		const res = await resolveChannelSlug(db, { platform: 'twitch', slug: 'oldname' });
		expect(res).toEqual({ slug: 'newname', from_history: true });
	});
});
