import type { CommandDeps } from "../deps.ts";
import { COLORS, FOOTER_TEXT } from "../theme.ts";
import type { CommandDefinition } from "../types.ts";

export function createGifCommand(deps: CommandDeps): CommandDefinition {
	return {
		name: "gif",
		description: "Fetch a bear GIF.",
		group: "fun",
		slow: true,
		options: [
			{
				name: "query",
				description: "What should the bear look for? (default: bear)",
				type: "string",
				required: false,
				default: "bear",
				rest: true,
			},
		],
		async run(ctx) {
			const raw = ctx.options.query;
			const query = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : "bear";
			const result = await deps.gif.search(query);

			if (!result) {
				return {
					embeds: [
						{
							title: "🐻 No luck",
							description: `The den found no GIF for **${query}**. Try another search term.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			const embed = {
				title: `🐻 ${result.title ?? `${query} GIF`}`,
				description: `Requested by <@${ctx.user.id}>`,
				color: COLORS.primary,
				image: { url: result.url },
				footer: { text: `${FOOTER_TEXT} • ${result.provider}` },
			};

			return {
				content: `[${query} GIF](${result.url})`,
				embeds: [embed],
			};
		},
	};
}
