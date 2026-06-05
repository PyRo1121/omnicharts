import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	createScheduledController,
	createMessageBatch,
	SELF,
} from 'cloudflare:test';
import { describe, it, expect, vi } from 'vitest';
import worker from '../src/index';
import { TWITCH_CRON } from '../src/cron-messages';
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
		const body = (await response.json()) as {
			service: string;
			status: string;
			db: string;
			twitch: string;
			tracked_channels: { twitch: number };
		};
		expect(body.service).toBe('omnicharts-ingest');
		expect(body).toHaveProperty('status');
		expect(body).toHaveProperty('timestamp');
		expect(body).toHaveProperty('twitch');
		expect(body).toHaveProperty('tracked_channels');
		expect(body).not.toHaveProperty('ingest_state_counts');
	});

	it('scheduled */1 sendBatch enqueues sweep+reconcile coverage messages (full mode)', async () => {
		const sendBatch = vi
			.spyOn(env.INGEST_QUEUE, 'sendBatch')
			.mockResolvedValue({ messages: [] } as Awaited<ReturnType<Env['INGEST_QUEUE']['sendBatch']>>);
		const scheduledEnv = { ...env, INGEST_COVERAGE_MODE: 'full' } as Env;
		const ctrl = createScheduledController({
			scheduledTime: new Date(1_000),
			cron: TWITCH_CRON
		});
		const ctx = createExecutionContext();
		await worker.scheduled(ctrl, scheduledEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(sendBatch).toHaveBeenCalledOnce();
		const batch = sendBatch.mock.calls[0]?.[0] as { body: { type: string } }[];
		expect(batch).toHaveLength(2);
		expect(batch.map((m) => m.body.type)).toEqual([
			'poll_twitch_sweep',
			'poll_twitch_reconcile'
		]);
		sendBatch.mockRestore();
	});

	it('queue acks unknown message types without retry', async () => {
		const warn = vi.spyOn(ingestLog, 'ingestWarn').mockImplementation(() => {});
		const batch = createMessageBatch('omnicharts-ingest', [
			{
				id: 'bad-1',
				body: { type: 'not_a_real_job' },
				timestamp: new Date(1_000),
				attempts: 1
			}
		]);
		const message = batch.messages[0]!;
		const ack = vi.spyOn(message, 'ack');
		const retry = vi.spyOn(message, 'retry');
		const ctx = createExecutionContext();
		await worker.queue(batch, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(ack).toHaveBeenCalledOnce();
		expect(retry).not.toHaveBeenCalled();
		expect(warn).toHaveBeenCalledWith(
			'queue: ack invalid message body (drop)',
			{ type: 'not_a_real_job' }
		);
	});
});
