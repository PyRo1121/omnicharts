/** Optional vars not always present in generated worker-configuration.d.ts */
declare interface Env {
	/** POST /admin/dev/* — blocked in production unless `1`. */
	ALLOW_DEV_SEED?: string;
}

interface ImportMetaEnv {
	readonly VITEST?: boolean;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
