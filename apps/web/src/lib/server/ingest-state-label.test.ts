import { describe, it, expect } from 'vitest';
import { ingestStateLabel } from '$lib/ingest-state-label';

describe('ingestStateLabel', () => {
	it('maps known ingest states to user-facing copy', () => {
		expect(ingestStateLabel('discovered')).toBe('Not tracking yet');
		expect(ingestStateLabel('tracked')).toBe('Actively tracked');
		expect(ingestStateLabel('dormant')).toBe('Dormant');
		expect(ingestStateLabel('retired')).toBe('Retired');
	});

	it('falls back for unknown states', () => {
		expect(ingestStateLabel('unknown')).toBe('Unknown');
	});
});
