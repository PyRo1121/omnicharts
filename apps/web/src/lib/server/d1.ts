/** D1 binding from adapter-cloudflare `platform.env.DB` (docs/11, doc 19 platformProxy). */
export function getD1(platform: App.Platform | null | undefined): D1Database | null {
	return platform?.env?.DB ?? null;
}
