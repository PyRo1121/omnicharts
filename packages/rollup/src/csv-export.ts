import type { ChannelDetailResponse } from './channel-api';
import type { RankingsChannelsResponse } from './channels-api';
import type { RankingsGamesResponse } from './games-api';

export const CSV_CONTENT_TYPE = 'text/csv; charset=utf-8';

export function escapeCsvCell(value: string | number | null | undefined): string {
	if (value == null) return '';
	const s = String(value);
	if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
	return s;
}

function csvRow(cells: (string | number | null | undefined)[]): string {
	return cells.map(escapeCsvCell).join(',');
}

export function channelRankingsToCsv(body: RankingsChannelsResponse): string {
	const lines = [
		csvRow([
			'rank',
			'slug',
			'display_name',
			'avatar_url',
			'hours_watched',
			'average_viewers',
			'peak_viewers',
			'airtime_hours',
			'stream_count',
			'tracked_since',
		]),
	];
	for (const item of body.items) {
		lines.push(
			csvRow([
				item.rank,
				item.slug,
				item.display_name,
				item.avatar_url,
				item.hours_watched,
				item.average_viewers,
				item.peak_viewers,
				item.airtime_hours,
				item.stream_count,
				item.tracked_since,
			]),
		);
	}
	return `${lines.join('\n')}\n`;
}

export function gameRankingsToCsv(body: RankingsGamesResponse): string {
	const lines = [csvRow(['rank', 'slug', 'name', 'average_viewers', 'hours_watched'])];
	for (const item of body.items) {
		lines.push(csvRow([item.rank, item.slug, item.name, item.average_viewers, item.hours_watched]));
	}
	return `${lines.join('\n')}\n`;
}

export function channelDetailToCsv(body: ChannelDetailResponse): string {
	const lines = [csvRow(['date', 'hours_watched', 'average_viewers', 'peak_viewers', 'airtime_hours', 'stream_count'])];
	for (const day of body.daily) {
		lines.push(csvRow([day.date, day.hours_watched, day.average_viewers, day.peak_viewers, day.airtime_hours, day.stream_count]));
	}
	return `${lines.join('\n')}\n`;
}

export function csvDownloadFilename(parts: string[]): string {
	const safe = parts
		.filter(Boolean)
		.map((p) => p.toLowerCase().replace(/[^a-z0-9._-]+/g, '-'))
		.join('-');
	return `omnicharts-${safe}.csv`;
}

export function csvAttachmentHeaders(filename: string): Record<string, string> {
	return {
		'content-type': CSV_CONTENT_TYPE,
		'content-disposition': `attachment; filename="${filename}"`,
	};
}
