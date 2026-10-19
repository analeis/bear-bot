import type { CommandDeps } from "../deps.ts";
import { COLORS, FOOTER_TEXT, usageFor } from "../theme.ts";
import type { CommandDefinition, CommandGroup } from "../types.ts";

const GROUP_TITLES: Record<CommandGroup, string> = {
	fun: "🐻 Fun",
	economy: "🪙 Bear economy",
};

const GROUP_ORDER: CommandGroup[] = ["fun", "economy"];

export function createHelpCommand(deps: CommandDeps): CommandDefinition {
	return {
		name: "help",
		description: "Show the bear-bot command list.",
		group: "fun",
		aliases: ["commands"],
		options: [
			{
				name: "command",
				description: "Show details for a single command.",
				type: "string",
				required: false,
			},
		],
		async run(ctx) {
			const registry = deps.registry();
			const wanted = ctx.options.command;

			if (typeof wanted === "string" && wanted.trim().length > 0) {
				const definition = registry.get(wanted.trim());
				if (!definition) {
					return {
						embeds: [
							{
								title: "🐻 Unknown command",
								description: `There is no \`${wanted.trim()}\` command. Try \`${usageFor(ctx.platform, "help")}\`.`,
								color: COLORS.error,
								footer: { text: FOOTER_TEXT },
							},
						],
					};
				}
				return { embeds: [describeCommand(definition, ctx.platform)] };
			}

			const definitions = registry.list();
			const fields = GROUP_ORDER.map((group) => {
				const inGroup = definitions.filter((definition) => definition.group === group);
				if (inGroup.length === 0) return null;
				return {
					name: GROUP_TITLES[group],
					value: inGroup
						.map(
							(definition) =>
								`\`${usageFor(ctx.platform, definition.name)}\` — ${definition.description}`,
						)
						.join("\n"),
					inline: false,
				};
			}).filter((field): field is NonNullable<typeof field> => field !== null);

			return {
				embeds: [
					{
						title: "🐻 bear-bot commands",
						description:
							ctx.platform === "discord"
								? "Everything is a slash command, as Discord requires."
								: "Fluxer uses prefix commands, so everything starts with `!bear`.",
						color: COLORS.primary,
						fields,
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};
}

function describeCommand(
	definition: CommandDefinition,
	platform: "discord" | "fluxer",
): {
	title: string;
	description: string;
	color: number;
	fields?: { name: string; value: string; inline?: boolean }[];
	footer: { text: string };
} {
	const fields: { name: string; value: string; inline?: boolean }[] = [
		{ name: "Usage", value: `\`${usageFor(platform, definition.name)}\``, inline: true },
		{ name: "Group", value: GROUP_TITLES[definition.group], inline: true },
	];

	if (definition.options && definition.options.length > 0) {
		fields.push({
			name: "Options",
			value: definition.options
				.map((option) => {
					const type = option.type === "user" ? "user" : option.type;
					const required = option.required ? "required" : "optional";
					return `\`${option.name}\` (${type}, ${required}) — ${option.description}`;
				})
				.join("\n"),
			inline: false,
		});
	}

	return {
		title: `🐻 /${definition.name}`,
		description: definition.description,
		color: COLORS.primary,
		fields,
		footer: { text: FOOTER_TEXT },
	};
}
