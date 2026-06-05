/**
 * Channel ingest lifecycle — docs/12-channel-discovery-and-tracking.md
 *
 * discovered → tracked → dormant → retired
 */
export type IngestState = 'discovered' | 'tracked' | 'dormant' | 'retired';

export const ingestStates = ['discovered', 'tracked', 'dormant', 'retired'] as const satisfies readonly IngestState[];

/** Channels eligible for rankings and live sampling. */
export const INGEST_STATE_TRACKED: IngestState = 'tracked';

export function isIngestState(raw: string): raw is IngestState {
	return (ingestStates as readonly string[]).includes(raw);
}
