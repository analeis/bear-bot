import { scopeKey } from "../../../db/index.ts";
import type { CommandDeps } from "../../deps.ts";
import { MAX_TRADE_AMOUNT } from "../../economy/constants.ts";
import { COLORS, FOOTER_TEXT } from "../../theme.ts";
import type { CommandDefinition } from "../../types.ts";
import { resolveItem } from "../item-lookup.ts";

export function createGiveCommand(deps: CommandDeps): CommandDefinition[] {
	const give: CommandDefinition = {
		name: "give",
		description: "Give a food item to another bear.",
		group: "economy",
		aliases: ["gift"],
		options: [
			{
				name: "item",
				description: "What are you giving?",
				type: "string",
				required: true,
			},
			{
				name: "amount",
				description: "How many? (1-99)",
				type: "integer",
				required: false,
				min: 1,
				max: MAX_TRADE_AMOUNT,
				default: 1,
			},
			{
				name: "user",
				description: "Who receives the gift?",
				type: "user",
				required: true,
			},
		],
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const resolved = resolveItem(
				typeof ctx.options.item === "string" ? ctx.options.item : "",
				"to give",
			);
			if (resolved.error) return { embeds: [resolved.error] };
			const { item } = resolved;

			const rawTarget = ctx.options.user;
			const targetId = typeof rawTarget === "string" ? rawTarget.trim() : "";
			if (!targetId) {
				return {
					embeds: [
						{
							title: "🐻 Who?",
							description: "Mention the bear you want to give the gift to.",
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			if (targetId === ctx.user.id) {
				return {
					embeds: [
						{
							title: "🐻 Awkward",
							description: "You cannot give yourself a gift. Try a mirror, that works nicely.",
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			const rawAmount = ctx.options.amount;
			const amount = Math.min(
				MAX_TRADE_AMOUNT,
				Math.max(1, typeof rawAmount === "number" ? Math.floor(rawAmount) : 1),
			);

			const owned = deps.economy.getItemQty(scope, ctx.user.id, item.id);
			if (owned < amount) {
				return {
					embeds: [
						{
							title: "🐻 Not enough to give",
							description: `You only have **${owned}x ${item.name}**.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			deps.economy.removeItem(scope, ctx.user.id, item.id, amount);
			deps.economy.addItem(scope, targetId, item.id, amount);

			return {
				embeds: [
					{
						title: "🎁 Gift delivered",
						description: `You gave **${amount}x ${item.emoji} ${item.name}** to <@${targetId}>.`,
						color: COLORS.success,
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	return [give];
}
