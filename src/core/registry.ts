import { COLORS, FOOTER_TEXT, usageFor } from "./theme.ts";
import type { BotEmbed, CommandContext, CommandDefinition, CommandResponse } from "./types.ts";

/** Registry of every command bear-bot exposes, shared by all platforms. */
export class CommandRegistry {
	private readonly byName = new Map<string, CommandDefinition>();
	private readonly byAlias = new Map<string, string>();

	constructor(definitions: readonly CommandDefinition[] = []) {
		this.register(definitions);
	}

	register(definitions: readonly CommandDefinition[]): this {
		for (const definition of definitions) {
			this.byName.set(definition.name.toLowerCase(), definition);
			for (const alias of definition.aliases ?? []) {
				this.byAlias.set(alias.toLowerCase(), definition.name.toLowerCase());
			}
		}
		return this;
	}

	/** Looks a command up by name or alias. */
	get(name: string): CommandDefinition | undefined {
		const key = name.toLowerCase();
		const direct = this.byName.get(key);
		if (direct) return direct;
		const aliased = this.byAlias.get(key);
		return aliased ? this.byName.get(aliased) : undefined;
	}

	/** All registered commands, in registration order. */
	list(): CommandDefinition[] {
		return [...this.byName.values()];
	}

	/** Runs a command, turning failures into friendly error embeds. */
	async run(ctx: CommandContext): Promise<CommandResponse> {
		const definition = this.get(ctx.command);
		if (!definition) {
			return {
				embeds: [
					errorEmbed(
						`That command does not exist. Try \`${usageFor(ctx.platform, "help")}\` to see what this bear can do.`,
					),
				],
			};
		}

		try {
			return await definition.run(ctx);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return {
				embeds: [errorEmbed(`The bear stumbled. (${message})`)],
			};
		}
	}
}

/** Standard error embed. */
export function errorEmbed(description: string): BotEmbed {
	return {
		title: "🐻 Bear trouble",
		description,
		color: COLORS.error,
		footer: { text: FOOTER_TEXT },
	};
}
