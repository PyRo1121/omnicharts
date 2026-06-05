import { KICK_REQUESTS_PER_MIN_BUDGET } from './config';

export function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Local token bucket until Kick publishes RPM (ADR-003 ~1 req/s). */
export class KickRateBudget {
	private remaining: number;
	private windowEndsAt = Date.now() + 60_000;

	constructor(private readonly maxBudget: number = KICK_REQUESTS_PER_MIN_BUDGET) {
		this.remaining = maxBudget;
	}

	async consume(cost = 1): Promise<void> {
		const now = Date.now();
		if (now >= this.windowEndsAt) {
			this.remaining = this.maxBudget;
			this.windowEndsAt = now + 60_000;
		}

		if (this.remaining < cost) {
			const waitMs = Math.max(0, this.windowEndsAt - now) + 50;
			await sleepMs(waitMs);
			this.remaining = this.maxBudget;
			this.windowEndsAt = Date.now() + 60_000;
		}

		this.remaining -= cost;
	}
}

export function kickRetryAfterMs(headers: Headers, fallbackMs = 5_000): number {
	const retryAfter = headers.get('Retry-After');
	if (retryAfter) {
		const sec = Number(retryAfter);
		if (Number.isFinite(sec) && sec > 0) return sec * 1000;
	}
	return fallbackMs;
}
