import { describe, it, expect } from 'vitest';
import { parseQueueBody, type IngestQueueMessage } from '../src/messages';

describe('parseQueueBody', () => {
	const sample: IngestQueueMessage = {
		type: 'poll_channel_batch',
		platform: 'twitch',
		channel_ids: ['1'],
	};

	it('accepts object bodies from sendBatch', () => {
		expect(parseQueueBody(sample)).toEqual(sample);
	});

	it('accepts JSON string bodies', () => {
		expect(parseQueueBody(JSON.stringify(sample))).toEqual(sample);
	});

	it('rejects invalid payloads', () => {
		expect(parseQueueBody(null)).toBeNull();
		expect(parseQueueBody('not json')).toBeNull();
		expect(parseQueueBody({})).toBeNull();
		expect(parseQueueBody({ type: 'unknown_type' })).toBeNull();
		expect(parseQueueBody({ type: 'poll_platform' })).toBeNull();
		expect(parseQueueBody({ type: 'poll_channel_batch', platform: 'twitch' })).toBeNull();
	});
});
