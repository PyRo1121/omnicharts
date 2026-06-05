import { describe, expect, test } from 'vitest';
import { isValidLanguageCode, normalizeLanguageCode, parseOptionalLanguageParam } from '../src/language';

describe('normalizeLanguageCode', () => {
	test('returns null for absent or blank', () => {
		expect(normalizeLanguageCode(null)).toBeNull();
		expect(normalizeLanguageCode('')).toBeNull();
		expect(normalizeLanguageCode('  ')).toBeNull();
	});

	test('lowercases and trims', () => {
		expect(normalizeLanguageCode(' EN ')).toBe('en');
		expect(normalizeLanguageCode('Zh-TW')).toBe('zh-tw');
	});
});

describe('isValidLanguageCode', () => {
	test('accepts common Helix codes', () => {
		expect(isValidLanguageCode('en')).toBe(true);
		expect(isValidLanguageCode('es')).toBe(true);
		expect(isValidLanguageCode('zh-tw')).toBe(true);
		expect(isValidLanguageCode('other')).toBe(true);
	});

	test('rejects invalid shapes', () => {
		expect(isValidLanguageCode('e')).toBe(false);
		expect(isValidLanguageCode('english')).toBe(false);
		expect(isValidLanguageCode('en_US')).toBe(false);
		expect(isValidLanguageCode('en!')).toBe(false);
	});
});

describe('parseOptionalLanguageParam', () => {
	test('absent means no filter', () => {
		expect(parseOptionalLanguageParam(null)).toEqual({ ok: true, language: null });
		expect(parseOptionalLanguageParam('')).toEqual({ ok: true, language: null });
	});

	test('valid code passes through normalized', () => {
		expect(parseOptionalLanguageParam('EN')).toEqual({ ok: true, language: 'en' });
	});

	test('invalid code returns error', () => {
		expect(parseOptionalLanguageParam('english')).toEqual({
			ok: false,
			error: 'invalid_language',
		});
	});
});
