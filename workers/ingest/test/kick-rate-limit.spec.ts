import { describe, it, expect, vi, beforeEach } from 'vitest';
import { kickRetryAfterMs, KickRateBudget } from '../src/kick/rate-limit';

describe('KickRateBudget', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	it('consumes budget within window', async () => {
		const budget = new KickRateBudget(2);
		await budget.consume();
		await budget.consume();
		const pending = budget.consume();
		vi.advanceTimersByTime(60_050);
		await pending;
	});

	it('kickRetryAfterMs parses Retry-After header seconds', () => {
		const headers = new Headers({ 'Retry-After': '12' });
		expect(kickRetryAfterMs(headers)).toBe(12_000);
	});

	it('kickRetryAfterMs falls back when header missing', () => {
		expect(kickRetryAfterMs(new Headers(), 3_000)).toBe(3_000);
	});
});
