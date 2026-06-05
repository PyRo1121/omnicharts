import type { HelixStream } from './helix';

/** JSON array for D1 `tags_json`; null when absent or empty. */
export function helixTagsJson(tags: string[] | undefined): string | null {
	if (!tags?.length) return null;
	return JSON.stringify(tags);
}

export type HelixStreamSessionPersist = {
	language: string | null;
	tags_json: string | null;
	thumbnail_url: string | null;
	stream_type: string | null;
};

export function helixStreamSessionPersist(stream: HelixStream): HelixStreamSessionPersist {
	return {
		language: stream.language ?? null,
		tags_json: helixTagsJson(stream.tags),
		thumbnail_url: stream.thumbnail_url ?? null,
		stream_type: stream.type ?? null,
	};
}
