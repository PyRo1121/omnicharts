// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}
		// interface Locals {}
		interface Error {
			message?: string;
			suggestions?: { slug: string; platform: string; displayName: string }[];
		}
		// interface PageData {}
		// interface PageState {}
	}
}
