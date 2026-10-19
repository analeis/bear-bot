/**
 * Runtime configuration, resolved from environment variables.
 *
 * Every platform is optional: bear-bot starts whichever platforms have the
 * credentials they need, so a single deployment can serve Discord, Fluxer or
 * both at the same time.
 */

export interface DiscordConfig {
	token?: string;
	applicationId?: string;
	/** When set, commands are registered to this guild (instant, dev only). */
	guildId?: string;
}

export interface FluxerConfig {
	token?: string;
	/** Prefix used for Fluxer's prefix command syntax. */
	prefix: string;
	/** Override for self-hosted instances. */
	apiUrl?: string;
}

export interface GifConfig {
	klipyAppKey?: string;
	tenorApiKey?: string;
	giphyApiKey?: string;
	/** Stable customer id used by the GIF providers. */
	customerId: string;
}

export interface Config {
	discord: DiscordConfig;
	fluxer: FluxerConfig;
	/** Path of the SQLite database file. */
	databasePath: string;
	gif: GifConfig;
	/** Log verbosity. */
	logLevel: "debug" | "info" | "warn" | "error";
}

function env(name: string): string | undefined {
	const value = process.env[name];
	if (value === undefined) return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function envNumber(name: string, fallback: number): number {
	const raw = env(name);
	if (raw === undefined) return fallback;
	const parsed = Number(raw);
	return Number.isFinite(parsed) ? parsed : fallback;
}

function envLogLevel(): Config["logLevel"] {
	const raw = env("LOG_LEVEL")?.toLowerCase();
	if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") return raw;
	return "info";
}

export function loadConfig(): Config {
	return {
		discord: {
			token: env("DISCORD_TOKEN"),
			applicationId: env("DISCORD_APPLICATION_ID"),
			guildId: env("DISCORD_GUILD_ID"),
		},
		fluxer: {
			token: env("FLUXER_TOKEN"),
			prefix: env("FLUXER_PREFIX") ?? "!",
			apiUrl: env("FLUXER_API_URL"),
		},
		databasePath: env("DATABASE_PATH") ?? "./data/bear-bot.db",
		gif: {
			klipyAppKey: env("KLIPY_APP_KEY"),
			tenorApiKey: env("TENOR_API_KEY"),
			giphyApiKey: env("GIPHY_API_KEY"),
			customerId: env("GIF_CUSTOMER_ID") ?? "bear-bot",
		},
		logLevel: envLogLevel(),
	};
}

/** How often stamina regenerates, in milliseconds per point. */
export const STAMINA_REGEN_INTERVAL_MS = envNumber("STAMINA_REGEN_INTERVAL_MS", 60_000);

/** Maximum stamina a bear can hold. */
export const STAMINA_MAX = envNumber("STAMINA_MAX", 100);
