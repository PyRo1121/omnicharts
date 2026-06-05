import { isPlatformId, type PlatformId } from '@omnicharts/domain';
import { normalizeSearchQuery } from '../search/channels';

export type WatchlistCsvRow = {
	line: number;
	platform: PlatformId;
	slug: string;
};

export type WatchlistCsvParseErrorCode =
	| 'invalid_platform'
	| 'missing_slug'
	| 'missing_platform'
	| 'malformed_row'
	| 'duplicate_slug';

export type WatchlistCsvParseError = {
	line: number;
	code: WatchlistCsvParseErrorCode;
	message: string;
	slug?: string;
	raw?: string;
};

export type ParseWatchlistCsvResult = {
	rows: WatchlistCsvRow[];
	errors: WatchlistCsvParseError[];
};

const HEADER_ALIASES = new Set(['platform', 'slug', 'handle']);

function parseCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const ch = line[i]!;
		if (ch === '"') {
			if (inQuotes && line[i + 1] === '"') {
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
			continue;
		}
		if (ch === ',' && !inQuotes) {
			fields.push(current.trim());
			current = '';
			continue;
		}
		current += ch;
	}

	fields.push(current.trim());
	return fields;
}

function isHeaderRow(fields: string[]): boolean {
	if (fields.length < 2) return false;
	const a = fields[0]?.toLowerCase();
	const b = fields[1]?.toLowerCase();
	return a === 'platform' && (b === 'slug' || b === 'handle');
}

function slugColumnIndex(header: string[]): number {
	const second = header[1]?.toLowerCase();
	return second === 'handle' || second === 'slug' ? 1 : 1;
}

export function parseWatchlistCsv(text: string): ParseWatchlistCsvResult {
	const rows: WatchlistCsvRow[] = [];
	const errors: WatchlistCsvParseError[] = [];
	const seen = new Set<string>();

	const lines = text.split(/\r?\n/);
	let slugIdx = 1;

	for (let i = 0; i < lines.length; i++) {
		const lineNo = i + 1;
		const raw = lines[i] ?? '';
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;

		const fields = parseCsvLine(trimmed);
		if (fields.length < 2) {
			errors.push({
				line: lineNo,
				code: 'malformed_row',
				message: 'Expected platform,slug columns',
				raw: trimmed
			});
			continue;
		}

		if (isHeaderRow(fields)) {
			slugIdx = slugColumnIndex(fields);
			continue;
		}

		const platformRaw = fields[0]?.trim().toLowerCase();
		const slugRaw = fields[slugIdx]?.trim();

		if (!platformRaw) {
			errors.push({
				line: lineNo,
				code: 'missing_platform',
				message: 'platform is required',
				raw: trimmed
			});
			continue;
		}

		if (!isPlatformId(platformRaw)) {
			errors.push({
				line: lineNo,
				code: 'invalid_platform',
				message: `Unknown platform "${platformRaw}"`,
				raw: trimmed
			});
			continue;
		}

		const slug = normalizeSearchQuery(slugRaw ?? '');
		if (!slug) {
			errors.push({
				line: lineNo,
				code: 'missing_slug',
				message: 'slug is required',
				raw: trimmed
			});
			continue;
		}

		const dedupeKey = `${platformRaw}:${slug}`;
		if (seen.has(dedupeKey)) {
			errors.push({
				line: lineNo,
				code: 'duplicate_slug',
				message: `Duplicate ${platformRaw}/${slug}`,
				slug
			});
			continue;
		}
		seen.add(dedupeKey);

		rows.push({ line: lineNo, platform: platformRaw, slug });
	}

	return { rows, errors };
}
