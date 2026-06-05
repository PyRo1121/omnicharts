export type ResponseFormat = 'json' | 'csv';

export type ResponseFormatError = 'invalid_format';

export function parseResponseFormat(url: URL): { ok: true; format: ResponseFormat } | { ok: false; error: ResponseFormatError } {
	const raw = url.searchParams.get('format');
	if (!raw || raw === 'json') return { ok: true, format: 'json' };
	if (raw === 'csv') return { ok: true, format: 'csv' };
	return { ok: false, error: 'invalid_format' };
}
