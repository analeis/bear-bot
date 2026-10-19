import type { PlatformName } from "../core/types.ts";

/**
 * A chat platform bear-bot can run on. Adapters translate native payloads
 * (Discord interactions, Fluxer messages) into the shared command model.
 */
export interface PlatformAdapter {
	/** Name of the platform, used in logs and command help. */
	readonly name: PlatformName;
	/** Registers the platform's command surface (application commands, help text). */
	registerCommands(): Promise<void>;
	/** Connects to the platform. */
	start(): Promise<void>;
	/** Disconnects from the platform. */
	stop(): Promise<void>;
}
