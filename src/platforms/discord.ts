import {
	type APIApplicationCommandOption,
	ApplicationCommandOptionType,
	AttachmentBuilder,
	type ChatInputCommandInteraction,
	Client,
	EmbedBuilder,
	Events,
	GatewayIntentBits,
	MessageFlags,
	REST,
	type RESTPostAPIApplicationCommandsJSONBody,
	Routes,
} from "discord.js";
import type { DiscordConfig } from "../config.ts";
import type { Logger } from "../core/logger.ts";
import { type CommandRegistry, errorEmbed } from "../core/registry.ts";
import type {
	BotEmbed,
	CommandContext,
	CommandDefinition,
	CommandOption,
	OptionValue,
} from "../core/types.ts";
import type { PlatformAdapter } from "./types.ts";

/**
 * Discord adapter.
 *
 * Discord's current policy only allows slash commands, so bear-bot registers
 * real application commands and answers interactions. The privileged message
 * content intent is never requested.
 */
export class DiscordAdapter implements PlatformAdapter {
	readonly name = "discord" as const;

	private readonly client: Client;

	constructor(
		private readonly config: DiscordConfig,
		private readonly registry: CommandRegistry,
		private readonly logger: Logger,
	) {
		this.client = new Client({
			// Interactions arrive over the gateway; no message content is required.
			intents: [GatewayIntentBits.Guilds],
		});
	}

	/** Registers the application commands, globally or for a single guild. */
	async registerCommands(): Promise<void> {
		const token = this.config.token;
		if (!token) return;

		const rest = new REST({ version: "10" }).setToken(token);
		const applicationId = await this.resolveApplicationId(rest);
		const body: RESTPostAPIApplicationCommandsJSONBody[] = this.registry
			.list()
			.map(toDiscordCommand);

		if (this.config.guildId) {
			await rest.put(Routes.applicationGuildCommands(applicationId, this.config.guildId), { body });
			this.logger.info(
				`registered ${body.length} commands to guild ${this.config.guildId} (dev mode)`,
			);
			return;
		}

		await rest.put(Routes.applicationCommands(applicationId), { body });
		this.logger.info(`registered ${body.length} global commands`);
	}

	private async resolveApplicationId(rest: REST): Promise<string> {
		if (this.config.applicationId) return this.config.applicationId;
		const application = (await rest.get(Routes.currentApplication())) as { id: string };
		return application.id;
	}

	async start(): Promise<void> {
		const token = this.config.token;
		if (!token) return;

		this.client.on(Events.ClientReady, (client) => {
			this.logger.info(`logged in as ${client.user.tag}`);
		});

		this.client.on(Events.InteractionCreate, (interaction) => {
			if (!interaction.isChatInputCommand()) return;
			void this.handleInteraction(interaction);
		});

		this.client.on(Events.Error, (error) => {
			this.logger.error("client error:", error);
		});

		await this.client.login(token);
	}

	async stop(): Promise<void> {
		await this.client.destroy();
	}

	private async handleInteraction(interaction: ChatInputCommandInteraction): Promise<void> {
		const definition = this.registry.get(interaction.commandName);
		if (!definition) {
			await interaction.reply({
				embeds: [errorEmbed("That command does not exist.")],
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		const deferred = definition.slow === true;
		if (deferred) await interaction.deferReply();

		try {
			const ctx: CommandContext = {
				platform: "discord",
				command: interaction.commandName,
				user: {
					id: interaction.user.id,
					name: resolveDisplayName(interaction),
				},
				guildId: interaction.guildId ?? undefined,
				channelId: interaction.channelId,
				options: readOptions(interaction, definition.options ?? []),
				raw: interaction,
			};

			const response = await this.registry.run(ctx);
			const embeds = (response.embeds ?? []).map(toDiscordEmbed);
			const files = (response.attachments ?? []).map(
				(attachment) => new AttachmentBuilder(attachment.url, { name: attachment.name }),
			);

			if (deferred) {
				await interaction.editReply({ content: response.content, embeds, files });
			} else {
				await interaction.reply({
					content: response.content,
					embeds,
					files,
					flags: response.ephemeral ? MessageFlags.Ephemeral : undefined,
				});
			}
		} catch (error) {
			this.logger.error("command failed:", error);
			const embeds = [errorEmbed("The bear stumbled and the command failed.")];
			if (deferred) await interaction.editReply({ embeds });
			else await interaction.reply({ embeds, flags: MessageFlags.Ephemeral });
		}
	}
}

/** The Discord application command payload produced for a bear-bot command. */
export interface DiscordCommandPayload {
	name: string;
	description: string;
	options: APIApplicationCommandOption[];
}

/** Converts a command definition into the Discord application command shape. */
export function toDiscordCommand(definition: CommandDefinition): DiscordCommandPayload {
	return {
		name: definition.name,
		description: definition.description,
		options: (definition.options ?? []).map(toDiscordOption),
	};
}

/** Converts a single command option into the Discord application command shape. */
function toDiscordOption(option: CommandOption): APIApplicationCommandOption {
	const base = {
		name: option.name,
		description: option.description,
		required: option.required ?? false,
	};

	switch (option.type) {
		case "string":
			return {
				...base,
				type: ApplicationCommandOptionType.String,
				...(option.choices
					? {
							choices: option.choices.map((choice) => ({ name: choice.name, value: choice.value })),
						}
					: {}),
			};
		case "integer":
			return {
				...base,
				type: ApplicationCommandOptionType.Integer,
				...(option.min !== undefined ? { min_value: option.min } : {}),
				...(option.max !== undefined ? { max_value: option.max } : {}),
			};
		case "number":
			return {
				...base,
				type: ApplicationCommandOptionType.Number,
				...(option.min !== undefined ? { min_value: option.min } : {}),
				...(option.max !== undefined ? { max_value: option.max } : {}),
			};
		case "boolean":
			return { ...base, type: ApplicationCommandOptionType.Boolean };
		case "user":
			return { ...base, type: ApplicationCommandOptionType.User };
		default:
			return { ...base, type: ApplicationCommandOptionType.String };
	}
}

/** Best effort display name for the invoking user. */
function resolveDisplayName(interaction: ChatInputCommandInteraction): string {
	const member = interaction.member;
	if (member && "displayName" in member && typeof member.displayName === "string") {
		return member.displayName;
	}
	return interaction.user.globalName ?? interaction.user.username;
}

/** Reads the options of a Discord interaction into the shared option map. */ function readOptions(
	interaction: ChatInputCommandInteraction,
	options: readonly {
		name: string;
		type: CommandOption["type"];
		required?: boolean;
	}[],
): Record<string, OptionValue | undefined> {
	const values: Record<string, OptionValue | undefined> = {};

	for (const option of options) {
		switch (option.type) {
			case "string":
				values[option.name] =
					interaction.options.getString(option.name, option.required) ?? undefined;
				break;
			case "integer":
				values[option.name] =
					interaction.options.getInteger(option.name, option.required) ?? undefined;
				break;
			case "number":
				values[option.name] =
					interaction.options.getNumber(option.name, option.required) ?? undefined;
				break;
			case "boolean":
				values[option.name] =
					interaction.options.getBoolean(option.name, option.required) ?? undefined;
				break;
			case "user":
				values[option.name] = interaction.options.getUser(option.name, option.required)?.id;
				break;
		}
	}

	return values;
}

/** Converts a shared embed into a Discord embed. */
export function toDiscordEmbed(embed: BotEmbed): EmbedBuilder {
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
		builder.addFields(
			embed.fields.map((field) => ({
				name: field.name,
				value: field.value,
				inline: field.inline ?? false,
			})),
		);
	}
	return builder;
}
