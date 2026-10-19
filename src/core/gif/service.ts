/**
 * GIF search.
 *
 * Providers are tried in order of quality: an explicitly configured Klipy,
 * Tenor or Giphy key wins, otherwise a keyless Giphy fallback is used so the
 * command works out of the box.
 */

export interface GifResult {
	/** Direct link to the animated file. */
	url: string;
	/** Provider that produced the result. */
	provider: string;
	/** Optional title of the GIF. */
	title?: string;
}

export interface GifServiceOptions {
	klipyAppKey?: string;
	tenorApiKey?: string;
	giphyApiKey?: string;
	customerId?: string;
	fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
	timeoutMs?: number;
}

const USER_AGENT =
	"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function isGifUrl(url: string): boolean {
	return /\.gif(\?|$)/i.test(url);
}

function isAnimatedUrl(url: string): boolean {
	return /\.(gif|mp4|webm)(\?|$)/i.test(url);
}

export class GifService {
	private readonly fetchImpl: (url: string, init?: RequestInit) => Promise<Response>;
	private readonly timeoutMs: number;

	constructor(private readonly options: GifServiceOptions = {}) {
		this.fetchImpl = options.fetchImpl ?? fetch;
		this.timeoutMs = options.timeoutMs ?? 8_000;
	}

	/** Searches for a GIF matching the query. */
	async search(query: string): Promise<GifResult | null> {
		const providers: (() => Promise<GifResult | null>)[] = [];

		if (this.options.klipyAppKey) providers.push(() => this.searchKlipy(query));
		if (this.options.tenorApiKey) providers.push(() => this.searchTenor(query));
		if (this.options.giphyApiKey) providers.push(() => this.searchGiphy(query));
		providers.push(() => this.searchGiphyPublic(query));

		for (const provider of providers) {
			try {
				const result = await provider();
				if (result) return result;
			} catch {
				// Try the next provider.
			}
		}
		return null;
	}

	private async request(url: string): Promise<Response> {
		return this.fetchImpl(url, {
			headers: { "user-agent": USER_AGENT, accept: "application/json,text/html,*/*" },
			signal: AbortSignal.timeout(this.timeoutMs),
		});
	}

	/** Klipy (formerly Tenor) API. */
	private async searchKlipy(query: string): Promise<GifResult | null> {
		const key = this.options.klipyAppKey;
		if (!key) return null;

		const url = new URL(`https://api.klipy.com/api/v1/${key}/gifs/search`);
		url.searchParams.set("q", query);
		url.searchParams.set("per_page", "12");
		url.searchParams.set("page", "1");
		url.searchParams.set("customer_id", this.options.customerId ?? "bear-bot");
		url.searchParams.set("locale", "en_US");

		const response = await this.request(url.toString());
		if (!response.ok) return null;
		const payload: unknown = await response.json();
		return this.pickKlipyResult(payload);
	}

	private pickKlipyResult(payload: unknown): GifResult | null {
		const items = findArray(payload);
		for (const item of items) {
			const media = readRecord(item)?.media;
			if (!media) continue;
			const gif = readRecord(media)?.gif;
			const gifUrl = readRecord(gif)?.url;
			if (typeof gifUrl === "string" && isGifUrl(gifUrl)) {
				const title = readRecord(item)?.title;
				return {
					url: gifUrl,
					provider: "klipy",
					...(typeof title === "string" ? { title } : {}),
				};
			}
		}
		return null;
	}

	/** Tenor v2 API. */
	private async searchTenor(query: string): Promise<GifResult | null> {
		const key = this.options.tenorApiKey;
		if (!key) return null;

		const url = new URL("https://tenor.googleapis.com/v2/search");
		url.searchParams.set("q", query);
		url.searchParams.set("key", key);
		url.searchParams.set("limit", "8");
		url.searchParams.set("media_filter", "gif,webp,mp4");

		const response = await this.request(url.toString());
		if (!response.ok) return null;
		const payload: unknown = await response.json();
		const results = readRecord(payload)?.results;
		if (!Array.isArray(results)) return null;

		for (const result of results) {
			const formats = readRecord(result)?.media_formats;
			if (!formats) continue;
			const record = readRecord(formats);
			for (const format of ["gif", "webp", "mp4"]) {
				const url = readRecord(record?.[format])?.url;
				if (typeof url === "string" && isAnimatedUrl(url)) {
					return { url, provider: "tenor" };
				}
			}
		}
		return null;
	}

	/** Giphy API (requires an API key). */
	private async searchGiphy(query: string): Promise<GifResult | null> {
		const key = this.options.giphyApiKey;
		if (!key) return null;

		const url = new URL("https://api.giphy.com/v1/gifs/search");
		url.searchParams.set("api_key", key);
		url.searchParams.set("q", query);
		url.searchParams.set("limit", "8");
		url.searchParams.set("rating", "pg");

		const response = await this.request(url.toString());
		if (!response.ok) return null;
		const payload: unknown = await response.json();
		const data = readRecord(payload)?.data;
		if (!Array.isArray(data)) return null;

		for (const item of data) {
			const images = readRecord(item)?.images;
			if (!images) continue;
			const record = readRecord(images);
			for (const size of ["original", "full", "medium"]) {
				const url = readRecord(record?.[size])?.url;
				if (typeof url === "string" && isGifUrl(url)) {
					const title = readRecord(item)?.title;
					return {
						url,
						provider: "giphy",
						...(typeof title === "string" ? { title } : {}),
					};
				}
			}
		}
		return null;
	}

	/**
	 * Keyless fallback: read the public Giphy search page and pick the first
	 * full size GIF it links to. Used when no API key is configured.
	 */
	private async searchGiphyPublic(query: string): Promise<GifResult | null> {
		const url = `https://giphy.com/search/${encodeURIComponent(query)}`;
		const response = await this.request(url);
		if (!response.ok) return null;
		const html = await response.text();

		const matches = html.match(/https:\/\/media\d*\.giphy\.com\/media\/[^"'\\\s]+?\/giphy\.gif/g);
		if (!matches) return null;

		const found = matches.find((candidate) => isGifUrl(candidate));
		if (!found) return null;
		return { url: found, provider: "giphy-public" };
	}
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
	return value as Record<string, unknown>;
}

/** Finds the first array of objects in a payload, whatever the wrapper is. */
function findArray(payload: unknown): unknown[] {
	const record = readRecord(payload);
	if (!record) return [];
	for (const value of Object.values(record)) {
		if (Array.isArray(value) && value.length > 0) return value;
	}
	const data = record?.data;
	if (data) {
		const dataRecord = readRecord(data);
		if (dataRecord) {
			for (const value of Object.values(dataRecord)) {
				if (Array.isArray(value) && value.length > 0) return value;
			}
		}
	}
	return [];
}
