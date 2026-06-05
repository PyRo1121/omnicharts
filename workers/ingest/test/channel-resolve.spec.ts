import { describe, it, expect } from 'vitest';
import { mockIngestD1 } from './helpers';
import { resolveChannelSlug } from '../src/ranking/channel-api';

describe('resolveChannelSlug', () => {
	it('returns current slug when channel exists', async () => {
		const db = mockIngestD1((sql) => ({
			bind: () => ({
				first: async () => (sql.includes('FROM channels') ? { slug: 'ninja' } : null),
			}),
		}));

		const res = await resolveChannelSlug(db, { platform: 'twitch', slug: 'ninja' });
		expect(res).toEqual({ slug: 'ninja', from_history: false });
	});

	it('returns new_slug from slug_history when channel missing', async () => {
		const db = mockIngestD1((sql) => ({
			bind: () => ({
				first: async () => (sql.includes('slug_history') ? { new_slug: 'newname' } : null),
			}),
		}));

		const res = await resolveChannelSlug(db, { platform: 'twitch', slug: 'oldname' });
		expect(res).toEqual({ slug: 'newname', from_history: true });
	});
});
