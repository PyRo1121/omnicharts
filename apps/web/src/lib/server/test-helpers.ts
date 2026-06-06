import { vi } from 'vitest';
import type { D1Database as RollupD1 } from '@omnicharts/rollup';
import type { Cookies } from '@sveltejs/kit';
import type { RequestEvent as ChannelDetailRequestEvent } from '../../routes/api/v1/channels/[slug]/$types';
import type { RequestEvent as CompareChannelsRequestEvent } from '../../routes/api/v1/compare/channels/$types';
import type { RequestEvent as GameDetailRequestEvent } from '../../routes/api/v1/games/[slug]/$types';
import type { RequestEvent as RankingsChannelsRequestEvent } from '../../routes/api/v1/rankings/channels/$types';
import type { PageServerLoadEvent as HomepageLoadEvent } from '../../routes/$types';
import type { PageServerLoadEvent as ChannelsLoadEvent } from '../../routes/channels/$types';
import type { PageServerLoadEvent as GamesLoadEvent } from '../../routes/games/$types';
import type { PageServerLoadEvent as OverviewLoadEvent } from '../../routes/overview/$types';
import type { PageServerLoadEvent as SearchLoadEvent } from '../../routes/search/$types';
import type { ServerLoadContext } from './load-context';

const TEST_EXECUTION_CONTEXT = {
	waitUntil: () => {},
	passThroughOnException: () => {},
} as unknown as ExecutionContext;

function noopCookies(): Cookies {
	return {
		get: () => undefined,
		getAll: () => [],
		set: () => {},
		delete: () => {},
		serialize: () => '',
	};
}

function stubTracing(): { enabled: false; root: never; current: never } {
	return { enabled: false, root: {} as never, current: {} as never };
}

function requestEventStub(routeId: string) {
	return {
		cookies: noopCookies(),
		getClientAddress: (): string => '127.0.0.1',
		locals: {},
		params: {},
		platform: undefined,
		request: new Request('http://localhost'),
		route: { id: routeId },
		setHeaders: (): void => {},
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing: stubTracing(),
	};
}

function serverLoadEventStub(routeId: string) {
	return {
		...requestEventStub(routeId),
		depends: () => {},
		parent: async () => ({}),
		untrack: <T>(fn: () => T) => fn(),
	};
}

/** Cloudflare platform stub with D1 binding for API route tests. */
export function testAppPlatform(db: RollupD1): App.Platform {
	return {
		env: {
			DB: db as unknown as D1Database,
			TWITCH_MIN_VIEWERS: '1',
			TWITCH_RANKING_MIN_AIRTIME_MINUTES: '1',
		},
		ctx: TEST_EXECUTION_CONTEXT,
		caches: globalThis.caches,
	};
}

/** Narrow PageServerLoad result — tests never redirect/error. */
export function expectPageData<T>(result: void | T): T {
	if (result == null || typeof result !== 'object') {
		throw new Error('PageServerLoad returned void (redirect/error)');
	}
	return result;
}

/** Normalize fetch mock input to URL string without Object#toString pitfalls. */
export function fetchInputUrl(input: RequestInfo | URL): string {
	if (typeof input === 'string') return input;
	if (input instanceof URL) return input.href;
	return input.url;
}

export function testCompareChannelsRequest(
	input: Pick<CompareChannelsRequestEvent, 'url' | 'fetch'> & Partial<Pick<CompareChannelsRequestEvent, 'platform'>>,
): CompareChannelsRequestEvent {
	return { ...requestEventStub('/api/v1/compare/channels'), ...input } as CompareChannelsRequestEvent;
}

export function testRankingsChannelsRequest(
	input: Pick<RankingsChannelsRequestEvent, 'url' | 'fetch'> & Partial<Pick<RankingsChannelsRequestEvent, 'platform'>>,
): RankingsChannelsRequestEvent {
	return { ...requestEventStub('/api/v1/rankings/channels'), ...input } as RankingsChannelsRequestEvent;
}

export function testChannelDetailRequest(
	input: Pick<ChannelDetailRequestEvent, 'url' | 'fetch' | 'params'> & Partial<Pick<ChannelDetailRequestEvent, 'platform'>>,
): ChannelDetailRequestEvent {
	return { ...requestEventStub('/api/v1/channels/[slug]'), ...input } as ChannelDetailRequestEvent;
}

export function testGameDetailRequest(
	input: Pick<GameDetailRequestEvent, 'url' | 'fetch' | 'params'> & Partial<Pick<GameDetailRequestEvent, 'platform'>>,
): GameDetailRequestEvent {
	return { ...requestEventStub('/api/v1/games/[slug]'), ...input } as GameDetailRequestEvent;
}

export function testHomepageLoadEvent(
	input: Pick<HomepageLoadEvent, 'url' | 'fetch'> & Partial<Pick<HomepageLoadEvent, 'setHeaders' | 'platform'>>,
): HomepageLoadEvent {
	return { ...serverLoadEventStub('/'), setHeaders: () => {}, ...input } as HomepageLoadEvent;
}

export function testOverviewLoadEvent(
	input: Pick<OverviewLoadEvent, 'url' | 'fetch'> & Partial<Pick<OverviewLoadEvent, 'setHeaders' | 'platform'>>,
): OverviewLoadEvent {
	return { ...serverLoadEventStub('/overview'), setHeaders: () => {}, ...input } as OverviewLoadEvent;
}

export function testSearchLoadEvent(
	input: Pick<SearchLoadEvent, 'url' | 'fetch'> & Partial<Pick<SearchLoadEvent, 'setHeaders' | 'platform'>>,
): SearchLoadEvent {
	return { ...serverLoadEventStub('/search'), setHeaders: () => {}, ...input } as SearchLoadEvent;
}

export function testChannelsPageLoadEvent(
	input: Pick<ChannelsLoadEvent, 'url' | 'fetch'> & Partial<Pick<ChannelsLoadEvent, 'setHeaders' | 'platform'>>,
): ChannelsLoadEvent {
	return { ...serverLoadEventStub('/channels'), setHeaders: () => {}, ...input } as ChannelsLoadEvent;
}

export function testGamesPageLoadEvent(
	input: Pick<GamesLoadEvent, 'url' | 'fetch'> & Partial<Pick<GamesLoadEvent, 'setHeaders' | 'platform'>>,
): GamesLoadEvent {
	return { ...serverLoadEventStub('/games'), setHeaders: () => {}, ...input } as GamesLoadEvent;
}

/** Vitest loads without Cloudflare platform — force ingest HTTP fallback. */
export function testLoadContext(fetchFn: typeof fetch): ServerLoadContext {
	return { fetch: fetchFn, db: null, cfEnv: null };
}

export function testLoadContextWithDb(fetchFn: typeof fetch, db: RollupD1): ServerLoadContext {
	return { fetch: fetchFn, db: db as unknown as D1Database, cfEnv: null };
}

type MockD1BatchEntry = { results?: unknown[] };

const D1_META = {
	duration: 0,
	size_after: 0,
	rows_read: 0,
	rows_written: 0,
	last_row_id: 0,
	changed_db: false,
	changes: 0,
} as D1Meta & Record<string, unknown>;

function stubPreparedStatement(): D1PreparedStatement {
	const stmt: D1PreparedStatement = {
		bind() {
			return stmt;
		},
		first: async () => null,
		run: async () => ({ success: true, results: [], meta: D1_META }),
		all: async () => ({ success: true, results: [], meta: D1_META }),
		raw: async () => [[]] as [string[], ...unknown[]],
	};
	return stmt;
}

function stubD1Session(): D1DatabaseSession {
	return {
		prepare: () => stubPreparedStatement(),
		batch: async () => [],
		getBookmark: () => null,
	};
}

/** Minimal D1 mock for homepage batch tests. */
export function mockD1Batch(batchResults: MockD1BatchEntry[]): { db: D1Database; batchMock: ReturnType<typeof vi.fn> } {
	const queue = [...batchResults];
	const toResult = (entry: MockD1BatchEntry): D1Result =>
		({
			success: true,
			results: entry.results ?? [],
			meta: D1_META,
		}) as D1Result;
	const batchMock = vi.fn().mockImplementation(async (statements: unknown[]) => {
		const count = Array.isArray(statements) ? statements.length : queue.length;
		return queue.splice(0, count).map(toResult);
	});
	const allMock = vi.fn().mockImplementation(async () => {
		const entry = queue.shift() ?? { results: [] };
		return toResult(entry);
	});
	const db: D1Database = {
		batch: batchMock,
		prepare: vi.fn().mockReturnValue({
			bind: vi.fn().mockReturnThis(),
			all: allMock,
			first: vi.fn(),
			run: vi.fn(),
			raw: vi.fn(),
		}),
		exec: vi.fn().mockResolvedValue({ count: 0, duration: 0 }),
		withSession: vi.fn().mockReturnValue(stubD1Session()),
		dump: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
	};
	return { db, batchMock };
}
