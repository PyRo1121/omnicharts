import { HELIX_POINTS_PER_MINUTE, HELIX_SAFE_POINTS_PER_MINUTE } from './config';

/** Tracks Helix rate limit from response headers + local budget */
export class HelixRateBudget {
	private remaining: number;
	private windowEndsAt = Date.now() + 60_000;

	constructor(private readonly maxBudget: number = HELIX_SAFE_POINTS_PER_MINUTE) {
		this.remaining = maxBudget;
	}

	applyHeaders(headers: Headers): void {
		const rem = headers.get('Ratelimit-Remaining');
		const reset = headers.get('Ratelimit-Reset');

		if (rem != null) {
			const parsed = Number(rem);
			if (Number.isFinite(parsed)) {
				this.remaining = Math.min(parsed, this.maxBudget);
			}
		}
		if (reset != null) {
			const resetSec = Number(reset);
			if (Number.isFinite(resetSec)) {
				this.windowEndsAt = resetSec * 1000;
			}
		}
	}

	async consume(cost: number): Promise<void> {
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

	snapshot(): { remaining: number; resetsInMs: number } {
		return {
			remaining: this.remaining,
			resetsInMs: Math.max(0, this.windowEndsAt - Date.now()),
		};
	}
}

export function helixRateLimitExceeded(headers: Headers): boolean {
	return headers.get('Ratelimit-Remaining') === '0' || headers.get('X-RateLimit-Remaining') === '0';
}

/** Wait until Twitch bucket reset — https://dev.twitch.tv/docs/api/guide#twitch-rate-limits */
export function helixRateLimitWaitMs(headers: Headers, fallbackMs = 5_000): number {
	const reset = headers.get('Ratelimit-Reset');
	if (reset != null) {
		const resetSec = Number(reset);
		if (Number.isFinite(resetSec)) {
			return Math.max(0, resetSec * 1000 - Date.now()) + 100;
		}
	}
	return fallbackMs + 100;
}

export function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Dynamic sweep/game-pass page cap when Helix budget is low — audit P0 risk. */
export function helixBudgetPageCap(budget: HelixRateBudget, configuredMaxPages: number): number {
	const { remaining } = budget.snapshot();
	if (remaining <= 5) return 0;
	if (remaining < 20) return Math.min(configuredMaxPages, 1);
	if (remaining < 60) return Math.min(configuredMaxPages, 3);
	if (remaining < 150) return Math.min(configuredMaxPages, 10);
	return configuredMaxPages;
}

export function helixBudgetAllowsFetch(budget: HelixRateBudget, cost = 1): boolean {
	const { remaining } = budget.snapshot();
	return remaining > 5 && remaining >= cost;
}

/** Cap rotating game-pass slices when Helix budget is low. */
export function helixBudgetGamesPerCycle(budget: HelixRateBudget, configured: number): number {
	const { remaining } = budget.snapshot();
	if (remaining <= 5) return 0;
	if (remaining < 20) return Math.min(configured, 1);
	if (remaining < 60) return Math.min(configured, 2);
	return configured;
}

/** Cap reconcile stream batches — 1 Helix point per batch of ≤100 user_ids. */
export function helixBudgetReconcileBatches(budget: HelixRateBudget, configuredBatches: number): number {
	const { remaining } = budget.snapshot();
	if (remaining <= 5) return 0;
	const reserve = 10;
	const available = Math.max(0, remaining - reserve);
	return Math.min(configuredBatches, Math.floor(available));
}

/** For logging / health */
export { HELIX_POINTS_PER_MINUTE };
