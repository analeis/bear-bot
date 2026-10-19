import { STAMINA_MAX } from "../../../config.ts";
import { scopeKey } from "../../../db/index.ts";
import type { CommandDeps } from "../../deps.ts";
import { RARITY_COLORS, RARITY_LABELS } from "../../economy/items.ts";
import { COLORS, FOOTER_TEXT, formatCoins } from "../../theme.ts";
import type { CommandDefinition } from "../../types.ts";
import { resolveItem } from "../item-lookup.ts";

export function createInventoryCommands(deps: CommandDeps): CommandDefinition[] {
	const inventory: CommandDefinition = {
		name: "inventory",
		description: "Show the food you are carrying.",
		group: "economy",
		aliases: ["inv", "bag"],
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			deps.economy.getUser(scope, ctx.user.id);
			const entries = deps.economy.inventory(scope, ctx.user.id);

			if (entries.length === 0) {
				return {
					embeds: [
						{
							title: "🎒 Empty paws",
							description:
								"You are carrying nothing. Try `/hunt` or `/forage`, or buy food in the `/shop`.",
							color: COLORS.muted,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			const totalValue = entries.reduce((sum, entry) => sum + entry.item.sellPrice * entry.qty, 0);

			return {
				embeds: [
					{
						title: "🎒 The bear's pack",
						description: `**${ctx.user.name}** is carrying ${entries.reduce(
							(sum, entry) => sum + entry.qty,
							0,
						)} items worth ${formatCoins(totalValue)}.`,
						color: COLORS.primary,
						fields: entries.map((entry) => ({
							name: `${entry.item.emoji} ${entry.item.name} x${entry.qty}`,
							value: `${RARITY_LABELS[entry.item.rarity]} — sells for ${formatCoins(
								entry.item.sellPrice * entry.qty,
							)}`,
							inline: true,
						})),
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	const eat: CommandDefinition = {
		name: "eat",
		description: "Eat a food item to restore stamina.",
		group: "economy",
		options: [
			{
				name: "item",
				description: "What do you want to eat?",
				type: "string",
				required: true,
			},
		],
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const resolved = resolveItem(
				typeof ctx.options.item === "string" ? ctx.options.item : "",
				"to eat",
			);
			if (resolved.error) return { embeds: [resolved.error] };
			const { item } = resolved;

			const user = deps.economy.getUser(scope, ctx.user.id);
			const owned = deps.economy.getItemQty(scope, ctx.user.id, item.id);
			if (owned <= 0) {
				return {
					embeds: [
						{
							title: "🐻 Nothing to eat",
							description: `You do not have any ${item.name.toLowerCase()}. Go hunt some!`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			if (item.stamina <= 0) {
				return {
					embeds: [
						{
							title: "🐻 Not edible",
							description: `A ${item.name.toLowerCase()} is a treasure, not a meal. Sell it instead!`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			if (user.stamina >= STAMINA_MAX) {
				return {
					embeds: [
						{
							title: "🐻 Not hungry",
							description: "Your stamina is already full. Save it for later!",
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			deps.economy.removeItem(scope, ctx.user.id, item.id, 1);
			const stamina = deps.economy.restoreStamina(scope, ctx.user.id, item.stamina);

			return {
				embeds: [
					{
						title: `${item.emoji} Nom`,
						description: `You eat the ${item.name.toLowerCase()}. It is delicious.`,
						color: RARITY_COLORS[item.rarity],
						fields: [
							{
								name: "Stamina",
								value: `${user.stamina} → ${stamina}`,
								inline: true,
							},
						],
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	return [inventory, eat];
}
