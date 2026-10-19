/** Shared visual theme for every bear-bot response. */

export const COLORS = {
	/** Bear brown, used for the main embeds. */
	primary: 0x8b5a2b,
	/** Honey gold, used for rewards. */
	honey: 0xf5a623,
	success: 0x4ade80,
	error: 0xef4444,
	info: 0x60a5fa,
	legendary: 0xfbbf24,
	muted: 0x6b7280,
} as const;

/** The bot's footer, used on every embed. */
export const FOOTER_TEXT = "🐻 bear-bot";

export function formatCoins(amount: number): string {
	return `${amount.toLocaleString("en-US")} BC`;
}

/** Formats a duration in milliseconds as a compact human string. */
export function formatDuration(ms: number): string {
	if (ms <= 0) return "now";
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		const rest = hours % 24;
		return `${days}d ${rest}h`;
	}
	if (hours > 0) {
		const rest = minutes % 60;
		return `${hours}h ${rest}m`;
	}
	if (minutes > 0) {
		const rest = seconds % 60;
		return `${minutes}m ${rest}s`;
	}
	return `${seconds}s`;
}

/** Renders the invocation prefix for the platform a command was used on. */
export function usageFor(platform: "discord" | "fluxer", name: string): string {
	return platform === "discord" ? `/${name}` : `!bear ${name}`;
}
