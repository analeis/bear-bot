/** A tiny leveled logger, so `LOG_LEVEL` actually does something. */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
};

export interface Logger {
	debug(message: string, ...args: unknown[]): void;
	info(message: string, ...args: unknown[]): void;
	warn(message: string, ...args: unknown[]): void;
	error(message: string, ...args: unknown[]): void;
}

/** Creates a logger that only prints messages at or above the given level. */
export function createLogger(level: LogLevel): Logger {
	const threshold = LEVEL_WEIGHT[level];

	const write = (logLevel: LogLevel, message: string, args: unknown[]) => {
		if (LEVEL_WEIGHT[logLevel] < threshold) return;
		const stamp = new Date().toISOString();
		const line = `[${stamp}] ${logLevel.toUpperCase().padEnd(5)} ${message}`;
		if (logLevel === "error") console.error(line, ...args);
		else if (logLevel === "warn") console.warn(line, ...args);
		else console.log(line, ...args);
	};

	return {
		debug: (message, ...args) => write("debug", message, args),
		info: (message, ...args) => write("info", message, args),
		warn: (message, ...args) => write("warn", message, args),
		error: (message, ...args) => write("error", message, args),
	};
}
