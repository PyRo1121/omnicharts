/** User-facing ingest state copy (see docs/16-search-and-resolution.md). */
export function ingestStateLabel(state: string): string {
	switch (state) {
		case 'discovered':
			return 'Not tracking yet';
		case 'tracked':
			return 'Actively tracked';
		case 'dormant':
			return 'Dormant';
		case 'retired':
			return 'Retired';
		default:
			return 'Unknown';
	}
}
