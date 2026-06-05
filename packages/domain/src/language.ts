/** BCP 47–lite stream language tags from Helix/Kick (e.g. en, es, zh-tw, other). */
const LANGUAGE_CODE_RE = /^(?:other|[a-z]{2,3})(?:-[a-z0-9]{2,8})?$/;

export function normalizeLanguageCode(raw: string | null | undefined): string | null {
	if (raw == null) return null;
	const trimmed = raw.trim().toLowerCase();
	return trimmed === '' ? null : trimmed;
}

export function isValidLanguageCode(code: string): boolean {
	return LANGUAGE_CODE_RE.test(code);
}

export type LanguageParseResult = { ok: true; language: string | null } | { ok: false; error: 'invalid_language' };

/** Parse optional `language` query param; absent/blank = no filter. */
export function parseOptionalLanguageParam(raw: string | null | undefined): LanguageParseResult {
	const normalized = normalizeLanguageCode(raw);
	if (normalized == null) return { ok: true, language: null };
	if (!isValidLanguageCode(normalized)) {
		return { ok: false, error: 'invalid_language' };
	}
	return { ok: true, language: normalized };
}
