import { env } from '$env/dynamic/private';

/** Ingest Worker base URL — server loads only (docs/19). */
export function getIngestBaseUrl(): string {
	return env.INGEST_URL ?? 'http://127.0.0.1:8787';
}
