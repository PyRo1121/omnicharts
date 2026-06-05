import { ROLLUP_CACHE_CONTROL } from '$lib/server/cache';

/** Forward ingest Worker response; preserve CSV `Content-Disposition` on proxy paths. */
export function proxyIngestResponse(res: Response, cacheControl = ROLLUP_CACHE_CONTROL): Response {
	const headers: Record<string, string> = {
		'content-type': res.headers.get('content-type') ?? 'application/json',
		'cache-control': res.headers.get('cache-control') ?? cacheControl
	};
	const disposition = res.headers.get('content-disposition');
	if (disposition) headers['content-disposition'] = disposition;
	return new Response(res.body, { status: res.status, headers });
}
