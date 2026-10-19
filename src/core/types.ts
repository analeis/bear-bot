/**
 * Platform-agnostic types shared by every bear-bot command.
 *
 * Nothing in this file may import from `discord.js` or `@fluxerjs/core`; the
 * platform adapters translate their native payloads into these shapes.
 */

export type PlatformName = "discord" | "fluxer";

export type OptionType = "string" | "integer" | "number" | "boolean" | "user";

export type OptionValue = string | number | boolean;

export interface CommandOption {
	/** Option name as typed by the user (lowercase, no spaces). */
	name: string;
	/** Human readable description shown in the command picker. */
	description: string;
	type: OptionType;
	/** Whether the option must be supplied. */
	required?: boolean;
	/** Restricts the accepted values (string options only). */
	choices?: readonly { name: string; value: string }[];
	/** Inclusive lower bound for numeric options. */
	min?: number;
	/** Inclusive upper bound for numeric options. */
	max?: number;
	/** Default value used when the option is omitted. */
	default?: OptionValue;
	/**
	 * Whether the option accepts free-form text. On prefix based platforms
	 * such options swallow the rest of the message, so `!bear fortune will it
	 * rain` keeps the whole sentence.
	 */
	rest?: boolean;
}

export interface BotEmbedField {
	name: string;
	value: string;
	inline?: boolean;
}

export interface BotEmbedFooter {
	text: string;
	iconUrl?: string;
}

export interface BotEmbedAuthor {
	name: string;
	iconUrl?: string;
	url?: string;
}

export interface BotEmbed {
	title?: string;
	description?: string;
	url?: string;
	/** 24-bit RGB colour, e.g. `0x8b5a2b`. */
	color?: number;
	/** ISO-8601 timestamp. */
	timestamp?: string;
	footer?: BotEmbedFooter;
	author?: BotEmbedAuthor;
	image?: { url: string };
	thumbnail?: { url: string };
	fields?: BotEmbedField[];
}

export interface BotAttachment {
	/** Remote URL of the file. */
	url: string;
	/** File name shown to the user. */
	name: string;
	description?: string;
}

export interface CommandResponse {
	/** Plain text body. */
	content?: string;
	/** Rich embeds. */
	embeds?: BotEmbed[];
	/** Files to upload alongside the message. */
	attachments?: BotAttachment[];
	/** Whether only the invoking user should see the response. */
	ephemeral?: boolean;
}

export interface CommandUser {
	id: string;
	/** Display name of the invoking user. */
	name: string;
}

export interface CommandContext {
	/** Platform the command was invoked on. */
	platform: PlatformName;
	/** Name of the command being invoked. */
	command: string;
	/** Invoking user. */
	user: CommandUser;
	/** Guild the command was invoked in, `undefined` in DMs. */
	guildId?: string;
	/** Channel the command was invoked in. */
	channelId: string;
	/** Normalised option values keyed by option name. */
	options: Record<string, OptionValue | undefined>;
	/** The native platform payload, for adapter specific features. */
	raw?: unknown;
}

export type CommandGroup = "fun" | "economy";

export interface CommandDefinition {
	/** Canonical command name (also the Discord slash command name). */
	name: string;
	/** Short description shown in command pickers. */
	description: string;
	/** Alternative names accepted on prefix based platforms. */
	aliases?: readonly string[];
	/** Command group used by the help command. */
	group: CommandGroup;
	/** Options accepted by the command. */
	options?: readonly CommandOption[];
	/**
	 * Marks commands that can take a while (network calls). Discord needs a
	 * deferred reply for those to stay inside the 3 second interaction budget.
	 */
	slow?: boolean;
	/** Runs the command and returns the response to send. */
	run(ctx: CommandContext): Promise<CommandResponse>;
}
