import { describe, it, expect } from 'vitest';
import { slugify } from '../src/twitch/slug';
import { HelixRateBudget } from '../src/twitch/rate-limit';
describe('twitch helpers', () => {
	it('slugify login names', () => {
		expect(slugify('Ninja')).toBe('ninja');
		expect(slugify('Some_Game')).toBe('some-game');
	});

	it('rate budget consumes points', async () => {
		const budget = new HelixRateBudget();
		await budget.consume(10);
		expect(budget.snapshot().remaining).toBeLessThan(720);
	});

});
