#!/usr/bin/env bun
import { loadConfig } from "./config.ts";
import { createCommands } from "./core/commands/index.ts";
import { Economy } from "./core/economy/economy.ts";
import { GifService } from "./core/gif/service.ts";
import { createLogger } from "./core/logger.ts";
import { CommandRegistry } from "./core/registry.ts";
import { openDatabase } from "./db/index.ts";
import { DiscordAdapter } from "./platforms/discord.ts";
import { FluxerAdapter } from "./platforms/fluxer.ts";
import type { PlatformAdapter } from "./platforms/types.ts";

const config = loadConfig();
const logger = createLogger(config.logLevel);

const database = openDatabase(config.databasePath);
const economy = new Economy(database);
const gif = new GifService({
	klipyAppKey: config.gif.klipyAppKey,
	tenorApiKey: config.gif.tenorApiKey,
	giphyApiKey: config.gif.giphyApiKey,
	customerId: config.gif.customerId,
});

// The registry is created after the commands, but the help command needs it,
// so it is resolved lazily through this getter.
let registry: CommandRegistry | undefined;
const deps = {
	economy,
	gif,
	registry: () => {
		if (!registry) throw new Error("Command registry is not ready yet");
		return registry;
	},
};
registry = new CommandRegistry(createCommands(deps));

const adapters: PlatformAdapter[] = [];
if (config.discord.token) adapters.push(new DiscordAdapter(config.discord, registry, logger));
if (config.fluxer.token) adapters.push(new FluxerAdapter(config.fluxer, registry, logger));

if (adapters.length === 0) {
	logger.error(
		"bear-bot needs at least one platform token. Set DISCORD_TOKEN and/or FLUXER_TOKEN.",
	);
	process.exit(1);
}

for (const adapter of adapters) {
	try {
		await adapter.registerCommands();
	} catch (error) {
		// A failing registration should not take the other platform down.
		logger.error(`could not register commands for ${adapter.name}:`, error);
	}
}

for (const adapter of adapters) {
	try {
		await adapter.start();
	} catch (error) {
		logger.error(`could not start the ${adapter.name} adapter:`, error);
		process.exit(1);
	}
}

logger.info("bear-bot is awake. Time to be a bear.");

let shuttingDown = false;
const shutdown = async (signal: string) => {
	if (shuttingDown) return;
	shuttingDown = true;
	logger.info(`bear-bot got ${signal}, heading into the den.`);
	for (const adapter of adapters) {
		try {
			await adapter.stop();
		} catch (error) {
			logger.error(`${adapter.name} failed to stop cleanly:`, error);
		}
	}
	database.close();
	process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
