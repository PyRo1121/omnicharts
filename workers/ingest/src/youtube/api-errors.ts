/** YouTube Data API error parsing — https://developers.google.com/youtube/v3/docs/errors */

export class YoutubeQuotaExceededError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'YoutubeQuotaExceededError';
	}
}

export function isYoutubeQuotaExceeded(status: number, body: string): boolean {
	if (status !== 403) return false;
	return body.includes('quotaExceeded') || body.includes('"reason":"quotaExceeded"');
}

export function youtubeApiHttpError(method: string, status: number, body: string): Error {
	if (isYoutubeQuotaExceeded(status, body)) {
		return new YoutubeQuotaExceededError(`YouTube ${method} quotaExceeded (${status})`);
	}
	return new Error(`YouTube ${method} ${status}: ${body.slice(0, 200)}`);
}
