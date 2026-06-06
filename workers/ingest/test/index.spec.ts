import { env, createExecutionContext, waitOnExecutionContext, createScheduledController, createMessageBatch, SELF } from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import { testEnv } from './helpers';
import worker from '../src/index';
import { TWITCH_CRON, MULTI_PLATFORM_CRON } from '../src/cron-messages';
import * as ingestLog from '../src/log';

const IncomingRequest = Request<unknown, IncomingRequestCfProperties>;

describe('ingest worker', () => {
	it('GET / returns service name', async () => {
		const request = new IncomingRequest('http://example.com/');
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(await response.text()).toContain('OmniCharts ingest');
	});

	it('GET /health returns public JSON', async () => {
		const response = await SELF.fetch('https://example.com/health');
		const body = await response.json();
		expect(body).toMatchObject({ service: 'omnicharts-ingest' });
		expect(body).toHaveProperty('status');
		expect(body).toHaveProperty('timestamp');
		expect(body).toHaveProperty('twitch');
		expect(body).toHaveProperty('tracked_channels');
		expect(body).not.toHaveProperty('ingest_state_counts');
	});

	it('scheduled */1 sendBatch enqueues sweep+reconcile coverage messages (full mode)', async () => {
		const sendBatch = vi.spyOn(env.INGEST_QUEUE, 'sendBatch').mockImplementation(async () => ({ messages: [] }));
		const scheduledEnv = testEnv({ ...env, INGEST_COVERAGE_MODE: 'full' });
		const ctrl = createScheduledController({
			scheduledTime: new Date(1_000),
			cron: TWITCH_CRON,
		});
		const ctx = createExecutionContext();
		await worker.scheduled(ctrl, scheduledEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(sendBatch).toHaveBeenCalledOnce();
		expect(sendBatch.mock.calls[0]?.[0]).toEqual([{ body: { type: 'poll_twitch_sweep' } }, { body: { type: 'poll_twitch_reconcile' } }]);
		sendBatch.mockRestore();
	});

	it('scheduled */2 sendBatch enqueues kick+youtube tracked poll', async () => {
		const sendBatch = vi.spyOn(env.INGEST_QUEUE, 'sendBatch').mockImplementation(async () => ({ messages: [] }));
		const ctrl = createScheduledController({
			scheduledTime: new Date(1_000),
			cron: MULTI_PLATFORM_CRON,
		});
		const ctx = createExecutionContext();
		await worker.scheduled(ctrl, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(sendBatch).toHaveBeenCalledOnce();
		expect(sendBatch.mock.calls[0]?.[0]).toEqual([{ body: { type: 'poll_kick_tracked' } }, { body: { type: 'poll_youtube_tracked' } }]);
		sendBatch.mockRestore();
	});

	it('queue acks unknown message types without retry', async () => {
		const warn = vi.spyOn(ingestLog, 'ingestWarn').mockImplementation(() => {});
		const batch = createMessageBatch('omnicharts-ingest', [
			{
				id: 'bad-1',
				body: { type: 'not_a_real_job' },
				timestamp: new Date(1_000),
				attempts: 1,
			},
		]);
		const [message] = batch.messages;
		expect(message).toBeDefined();
		const ack = vi.spyOn(message, 'ack');
		const retry = vi.spyOn(message, 'retry');
		const ctx = createExecutionContext();
		await worker.queue(batch, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(ack).toHaveBeenCalledOnce();
		expect(retry).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith('queue: ack invalid message body (drop)', { type: 'not_a_real_job' });
	});
});
