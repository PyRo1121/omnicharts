/** Runtime checks for untyped JSON in verify/dev/ingest CLI scripts. */

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

export function readString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key];
	return typeof value === 'string' ? value : undefined;
}

export function readNumber(record: Record<string, unknown>, key: string): number | undefined {
	const value = record[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function readBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
	const value = record[key];
	return typeof value === 'boolean' ? value : undefined;
}

export function readArray(record: Record<string, unknown>, key: string): unknown[] | undefined {
	const value = record[key];
	return Array.isArray(value) ? value : undefined;
}

export function readNestedRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
	const value = record[key];
	return isRecord(value) ? value : undefined;
}

export function readNumberRecord(record: Record<string, unknown>, key: string): Record<string, number> | undefined {
	const value = record[key];
	if (!isRecord(value)) return undefined;
	const out: Record<string, number> = {};
	for (const [entryKey, entryValue] of Object.entries(value)) {
		if (typeof entryValue !== 'number' || !Number.isFinite(entryValue)) return undefined;
		out[entryKey] = entryValue;
	}
	return out;
}

export function readNumberArrayRecord(record: Record<string, unknown>, key: string): Record<string, number[]> | undefined {
	const value = record[key];
	if (!isRecord(value)) return undefined;
	const out: Record<string, number[]> = {};
	for (const [entryKey, entryValue] of Object.entries(value)) {
		if (!Array.isArray(entryValue)) return undefined;
		const hits: number[] = [];
		for (const hit of entryValue) {
			if (typeof hit !== 'number' || !Number.isFinite(hit)) return undefined;
			hits.push(hit);
		}
		out[entryKey] = hits;
	}
	return out;
}

type StatementLoc = { start: { line: number } };

export function readStatementMap(record: Record<string, unknown>, key: string): Record<string, StatementLoc> | undefined {
	const value = record[key];
	if (!isRecord(value)) return undefined;
	const out: Record<string, StatementLoc> = {};
	for (const [entryKey, entryValue] of Object.entries(value)) {
		if (!isRecord(entryValue)) return undefined;
		const start = entryValue.start;
		if (!isRecord(start)) return undefined;
		const line = start.line;
		if (typeof line !== 'number' || !Number.isFinite(line)) return undefined;
		out[entryKey] = { start: { line } };
	}
	return out;
}

export function parseJsonRecord(text: string): Record<string, unknown> | null {
	try {
		const parsed: unknown = JSON.parse(text);
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export async function readResponseJson(res: Response): Promise<Record<string, unknown> | null> {
	try {
		const data: unknown = await res.json();
		return isRecord(data) ? data : null;
	} catch {
		return null;
	}
}

export function parseCoverageFinal(raw: unknown): Record<string, Record<string, unknown>> | null {
	if (!isRecord(raw)) return null;
	const out: Record<string, Record<string, unknown>> = {};
	for (const [path, entry] of Object.entries(raw)) {
		if (!isRecord(entry)) return null;
		out[path] = entry;
	}
	return out;
}

export function parseWranglerJsonRows(stdout: string): Record<string, unknown>[] {
	const trimmed = stdout.trim();
	if (!trimmed) return [];
	const parsed: unknown = JSON.parse(trimmed);
	if (Array.isArray(parsed)) {
		if (parsed.length > 0 && isRecord(parsed[0]) && 'results' in parsed[0]) {
			return parsed.flatMap((batch) => {
				if (!isRecord(batch)) return [];
				const results = batch.results;
				if (!Array.isArray(results)) return [];
				return results.filter(isRecord);
			});
		}
		return parsed.filter(isRecord);
	}
	if (isRecord(parsed)) {
		const result = parsed.result;
		if (Array.isArray(result) && result[0] && isRecord(result[0])) {
			const results = result[0].results;
			if (Array.isArray(results)) return results.filter(isRecord);
		}
	}
	return [];
}

export function readSqliteName(row: Record<string, unknown>): string {
	return readString(row, 'name') ?? readString(row, 'NAME') ?? '';
}

export type RankingsListBody = {
	platform: string;
	period: string;
	updated_at: string;
	items: unknown[];
};

export function parseRankingsListBody(data: unknown): RankingsListBody | null {
	if (!isRecord(data)) return null;
	const platform = readString(data, 'platform');
	const period = readString(data, 'period');
	const updated_at = readString(data, 'updated_at');
	const items = readArray(data, 'items');
	if (!platform || !period || !updated_at || !items) return null;
	return { platform, period, updated_at, items };
}

export type HealthBody = {
	status?: string;
	db?: string;
	twitch?: string;
};

export function parseHealthBody(data: unknown): HealthBody | null {
	if (!isRecord(data)) return null;
	return {
		status: readString(data, 'status'),
		db: readString(data, 'db'),
		twitch: readString(data, 'twitch'),
	};
}

export function readItemSlug(items: unknown): string | null {
	if (!Array.isArray(items) || items.length === 0) return null;
	const first = items[0];
	if (!isRecord(first)) return null;
	return readString(first, 'slug') ?? null;
}

export function readStatsNumber(json: Record<string, unknown> | null, key: string): number | undefined {
	const stats = json ? readNestedRecord(json, 'stats') : undefined;
	return stats ? readNumber(stats, key) : undefined;
}

export function readStatsNestedNumber(json: Record<string, unknown> | null, outerKey: string, innerKey: string): number | undefined {
	const stats = json ? readNestedRecord(json, 'stats') : undefined;
	const nested = stats ? readNestedRecord(stats, outerKey) : undefined;
	return nested ? readNumber(nested, innerKey) : undefined;
}

export function readErrorMessage(json: Record<string, unknown> | null): string | undefined {
	if (!json) return undefined;
	const err = json.error;
	if (typeof err === 'string') return err;
	if (err !== undefined) return JSON.stringify(err);
	return undefined;
}

export function formatJsonField(value: unknown, fallback = '?'): string {
	if (value === undefined || value === null) return fallback;
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
	return fallback;
}

export function readStringArray(record: Record<string, unknown>, key: string): string[] | undefined {
	const value = record[key];
	if (!Array.isArray(value)) return undefined;
	return value.every((item) => typeof item === 'string') ? value : undefined;
}

export type AdminOkBody = {
	ok: boolean;
	skipped?: boolean;
	stats?: Record<string, unknown>;
};

export function parseAdminOkBody(data: unknown): AdminOkBody | null {
	if (!isRecord(data)) return null;
	return {
		ok: data.ok === true,
		skipped: data.skipped === true ? true : undefined,
		stats: readNestedRecord(data, 'stats'),
	};
}

export function hasJsonVersion(data: unknown): boolean {
	if (!isRecord(data)) return false;
	return readNumber(data, 'version') !== undefined;
}
