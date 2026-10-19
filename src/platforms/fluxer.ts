import { Client, EmbedBuilder, Events, type Message, parsePrefixCommand } from "@fluxerjs/core";
import type { FluxerConfig } from "../config.ts";
import type { Logger } from "../core/logger.ts";
import type { CommandRegistry } from "../core/registry.ts";
import { COLORS, FOOTER_TEXT } from "../core/theme.ts";
import type { BotEmbed, CommandContext, CommandDefinition, OptionValue } from "../core/types.ts";
import type { PlatformAdapter } from "./types.ts";

/** Names that can be used in front of a command, e.g. `!bear hunt`. */
const NAMESPACES = new Set(["bear", "bearbot", "b"]);

/**
 * Fluxer adapter.
 *
 * Fluxer does not expose interaction (slash command) endpoints yet, so the
 * same command registry is exposed through Fluxer's prefix command syntax:
 * `!bear hunt` or `!hunt`. When Fluxer ships interactions, only this
 * adapter has to change.
 */
export class FluxerAdapter implements PlatformAdapter {
	readonly name = "fluxer" as const;

	private readonly client: Client;

	constructor(
		private readonly config: FluxerConfig,
		private readonly registry: CommandRegistry,
		private readonly logger: Logger,
	) {
		this.client = new Client(
			config.apiUrl ? { instance: { api_public: config.apiUrl } } : undefined,
		);
	}

	/** Fluxer has no application command registration. */
	async registerCommands(): Promise<void> {
		const names = this.registry
			.list()
			.map((definition) => `${this.config.prefix}bear ${definition.name}`)
			.join(", ");
		this.logger.info(`prefix commands ready: ${names}`);
	}

	async start(): Promise<void> {
		const token = this.config.token;
		if (!token) return;

		this.client.on(Events.Ready, () => {
			this.logger.info(`logged in as ${this.client.user?.username ?? "bot"}`);
		});

		this.client.on(Events.MessageCreate, (message) => {
			void this.handleMessage(message);
		});

		this.client.on(Events.Error, (error) => {
			this.logger.error("client error:", error);
		});

		await this.client.login(token);
	}

	async stop(): Promise<void> {
		await this.client.destroy();
	}

	private async handleMessage(message: Message): Promise<void> {
		if (message.author.bot) return;
		if (!message.content) return;

		const parsed = parseInvocation(message.content, this.config.prefix);
		if (!parsed) return;

		const { name, args, namespaceOnly } = parsed;

		if (namespaceOnly) {
			await this.reply(message, {
				embeds: [
					{
						title: "🐻 bear-bot",
						description: "Say `!bear help` to see every command.",
						color: COLORS.primary,
						footer: { text: FOOTER_TEXT },
					},
				],
			});
			return;
		}

		const definition = this.registry.get(name);
		if (!definition) {
			await this.reply(message, {
				embeds: [
					{
						title: "🐻 Unknown command",
						description: `There is no \`${name}\` command. Try \`${this.config.prefix}bear help\`.`,
						color: COLORS.error,
						footer: { text: FOOTER_TEXT },
					},
				],
			});
			return;
		}

		const ctx: CommandContext = {
			platform: "fluxer",
			command: definition.name,
			user: {
				id: message.author.id,
				name: message.member?.displayName ?? message.author.globalName ?? message.author.username,
			},
			guildId: message.guildId ?? undefined,
			channelId: message.channelId,
			options: parseOptions(args, definition),
			raw: message,
		};

		try {
			const response = await this.registry.run(ctx);
			await this.reply(message, {
				content: response.content,
				embeds: (response.embeds ?? []).map(toFluxerEmbed),
				files: (response.attachments ?? []).map((attachment) => ({
					name: attachment.name,
					url: attachment.url,
				})),
			});
		} catch (error) {
			this.logger.error("command failed:", error);
			await this.reply(message, {
				embeds: [
					{
						title: "🐻 Bear trouble",
						description: "The bear stumbled and the command failed.",
						color: COLORS.error,
						footer: { text: FOOTER_TEXT },
					},
				],
			});
		}
	}

	private async reply(message: Message, payload: Parameters<Message["reply"]>[0]): Promise<void> {
		try {
			await message.reply(payload);
		} catch (error) {
			this.logger.error("failed to reply:", error);
		}
	}
}

/**
 * Parses a prefix message into a command name and its arguments.
 *
 * `!bear hunt` and `!hunt` both resolve to the `hunt` command.
 */
export function parseInvocation(
	content: string,
	prefix: string,
): { name: string; args: string[]; namespaceOnly: boolean } | null {
	const parsed = parsePrefixCommand(content, prefix);
	if (!parsed) return null;

	let { command, args } = parsed;

	if (NAMESPACES.has(command)) {
		const [first, ...rest] = args;
		if (first === undefined) {
			return { name: command, args: [], namespaceOnly: true };
		}
		command = first;
		args = rest;
	}

	return { name: command, args, namespaceOnly: false };
}

/**
 * Maps positional prefix arguments onto the command options. Options are
 * consumed in the order they are declared.
 */
export function parseOptions(
	args: string[],
	definition: CommandDefinition,
): Record<string, OptionValue | undefined> {
	const values: Record<string, OptionValue | undefined> = {};
	const options = definition.options ?? [];
	let index = 0;

	for (const option of options) {
		switch (option.type) {
			case "string": {
				if (option.rest) {
					const rest = args.slice(index).join(" ");
					index = args.length;
					if (rest.length > 0) values[option.name] = rest;
					break;
				}
				const raw = args[index];
				index += 1;
				if (raw !== undefined) values[option.name] = raw;
				break;
			}
			case "user": {
				const raw = args[index];
				index += 1;
				const id = extractUserId(raw);
				if (id) values[option.name] = id;
				break;
			}
			case "integer":
			case "number": {
				const raw = args[index];
				index += 1;
				const parsed = Number(raw);
				if (raw !== undefined && Number.isFinite(parsed)) values[option.name] = parsed;
				break;
			}
			case "boolean": {
				const raw = args[index]?.toLowerCase();
				if (raw === "true" || raw === "yes" || raw === "1") {
					values[option.name] = true;
					index += 1;
				} else if (raw === "false" || raw === "no" || raw === "0") {
					values[option.name] = false;
					index += 1;
				} else {
					values[option.name] = false;
				}
				break;
			}
		}
	}

	return values;
}

/** Extracts a user id from `<@123>`, `<@!123>` or a raw id. */
export function extractUserId(raw: string | undefined): string | undefined {
	if (!raw) return undefined;
	const mention = raw.match(/^<@!?(\d+)>$/);
	if (mention?.[1]) return mention[1];
	if (/^\d{5,32}$/.test(raw)) return raw;
	return undefined;
}

/** Converts a shared embed into a Fluxer embed. */
export function toFluxerEmbed(embed: BotEmbed): EmbedBuilder {
	const builder = new EmbedBuilder();
	if (embed.title) builder.setTitle(embed.title);
	if (embed.description) builder.setDescription(embed.description);
	if (embed.url) builder.setURL(embed.url);
	if (typeof embed.color === "number") builder.setColor(embed.color);
	if (embed.timestamp) builder.setTimestamp(new Date(embed.timestamp));
	if (embed.footer) {
		builder.setFooter({
			text: embed.footer.text,
			...(embed.footer.iconUrl ? { iconURL: embed.footer.iconUrl } : {}),
		});
	}
	if (embed.author) {
		builder.setAuthor({
			name: embed.author.name,
			...(embed.author.iconUrl ? { iconURL: embed.author.iconUrl } : {}),
			...(embed.author.url ? { url: embed.author.url } : {}),
		});
	}
	if (embed.image) builder.setImage(embed.image.url);
	if (embed.thumbnail) builder.setThumbnail(embed.thumbnail.url);
	if (embed.fields && embed.fields.length > 0) {
		builder.setFields(
			...embed.fields.map((field) => ({
				name: field.name,
				value: field.value,
				inline: field.inline ?? false,
			})),
		);
	}
	return builder;
}
