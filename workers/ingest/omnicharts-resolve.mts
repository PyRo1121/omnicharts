import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repo-root-relative aliases for @omnicharts/* (vitest + wrangler bundle). */
const ingestDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(ingestDir, '../..');

export const omnichartsResolveAlias = {
	'@omnicharts/domain': path.join(repoRoot, 'packages/domain/src/index.ts'),
	'@omnicharts/rollup': path.join(repoRoot, 'packages/rollup/src/index.ts'),
} as const;

/** Paths relative to workers/ingest for wrangler.jsonc `alias`. */
export const omnichartsWranglerAlias = {
	'@omnicharts/domain': '../../packages/domain/src/index.ts',
	'@omnicharts/rollup': '../../packages/rollup/src/index.ts',
} as const;
