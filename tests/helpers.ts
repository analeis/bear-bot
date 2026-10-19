import { createCommands } from "../src/core/commands/index.ts";
import { Economy } from "../src/core/economy/economy.ts";
import { GifService } from "../src/core/gif/service.ts";
import { CommandRegistry } from "../src/core/registry.ts";
import type { CommandContext, CommandResponse } from "../src/core/types.ts";
import { openDatabase } from "../src/db/index.ts";

/** Builds a registry backed by an in-memory database. */
export function createHarness(options: { now?: () => number } = {}) {
	const db = openDatabase(":memory:");
	const economy = new Economy(db, options);
	const gif = new GifService({
		fetchImpl: async () => new Response(JSON.stringify({}), { status: 200 }),
	});

	let registry: CommandRegistry | undefined;
	const deps = {
		economy,
		gif,
		registry: () => {
			if (!registry) throw new Error("registry not ready");
			return registry;
		},
	};
	registry = new CommandRegistry(createCommands(deps));

	return { db, economy, registry };
}

/** Runs a command as if a user typed it. */
export async function run(
	registry: CommandRegistry,
	command: string,
	options: Record<string, string | number | boolean | undefined> = {},
	overrides: Partial<CommandContext> = {},
): Promise<CommandResponse> {
	const ctx: CommandContext = {
		platform: "discord",
		command,
		user: { id: "user-1", name: "Tester" },
		guildId: "guild-1",
		channelId: "channel-1",
		options,
		...overrides,
	};
	return registry.run(ctx);
}

/** Flattens an embed description for assertions. */
export function describeResponse(response: CommandResponse): string {
	const parts: string[] = [];
	if (response.content) parts.push(response.content);
	for (const embed of response.embeds ?? []) {
		parts.push(embed.title ?? "");
		parts.push(embed.description ?? "");
		for (const field of embed.fields ?? []) {
			parts.push(field.name);
			parts.push(field.value);
		}
	}
	return parts.join("\n");
}
