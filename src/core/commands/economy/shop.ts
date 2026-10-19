import { scopeKey } from "../../../db/index.ts";
import type { CommandDeps } from "../../deps.ts";
import { MAX_TRADE_AMOUNT } from "../../economy/constants.ts";
import { RARITY_LABELS, shopItems } from "../../economy/items.ts";
import { COLORS, FOOTER_TEXT, formatCoins } from "../../theme.ts";
import type { CommandDefinition } from "../../types.ts";
import { resolveItem } from "../item-lookup.ts";

export function createShopCommands(deps: CommandDeps): CommandDefinition[] {
	const shop: CommandDefinition = {
		name: "shop",
		description: "See what the market stall is selling.",
		group: "economy",
		aliases: ["market"],
		options: [
			{
				name: "item",
				description: "Show a single item.",
				type: "string",
				required: false,
			},
		],
		async run(ctx) {
			const raw = ctx.options.item;
			const query = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;

			if (query) {
				const resolved = resolveItem(query, "in the shop");
				if (resolved.error) return { embeds: [resolved.error] };
				const { item } = resolved;
				return {
					embeds: [
						{
							title: `${item.emoji} ${item.name}`,
							description: item.description,
							color: COLORS.honey,
							fields: [
								{ name: "Buy", value: formatCoins(item.buyPrice), inline: true },
								{ name: "Sell", value: formatCoins(item.sellPrice), inline: true },
								{ name: "Rarity", value: RARITY_LABELS[item.rarity], inline: true },
								{
									name: "Stamina",
									value: item.stamina > 0 ? `+${item.stamina}` : "Not edible",
									inline: true,
								},
							],
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			const items = shopItems();
			return {
				embeds: [
					{
						title: "🪙 The bear market",
						description:
							"Buy food with `/buy <item> <amount>`, or sell what you catch with `/sell <item> <amount>`.",
						color: COLORS.honey,
						fields: items.map((item) => ({
							name: `${item.emoji} ${item.name}`,
							value: `Buy ${formatCoins(item.buyPrice)} • Sell ${formatCoins(item.sellPrice)}`,
							inline: true,
						})),
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	const buy: CommandDefinition = {
		name: "buy",
		description: "Buy food from the market.",
		group: "economy",
		options: [
			{
				name: "item",
				description: "What do you want to buy?",
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
		],
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const resolved = resolveItem(
				typeof ctx.options.item === "string" ? ctx.options.item : "",
				"to buy",
			);
			if (resolved.error) return { embeds: [resolved.error] };
			const { item } = resolved;

			const rawAmount = ctx.options.amount;
			const amount = Math.min(
				MAX_TRADE_AMOUNT,
				Math.max(1, typeof rawAmount === "number" ? Math.floor(rawAmount) : 1),
			);
			const cost = item.buyPrice * amount;
			const user = deps.economy.getUser(scope, ctx.user.id);

			if (user.coins < cost) {
				return {
					embeds: [
						{
							title: "🐻 Not enough coins",
							description: `${amount}x ${item.name} costs ${formatCoins(cost)}, but you only have ${formatCoins(user.coins)}.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			deps.economy.spendCoins(scope, ctx.user.id, cost, `bought ${item.id} x${amount}`);
			deps.economy.addItem(scope, ctx.user.id, item.id, amount);

			return {
				embeds: [
					{
						title: "🛒 Purchase complete",
						description: `You bought **${amount}x ${item.emoji} ${item.name}** for ${formatCoins(cost)}.`,
						color: COLORS.success,
						fields: [{ name: "Coins left", value: formatCoins(user.coins - cost), inline: true }],
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	const sell: CommandDefinition = {
		name: "sell",
		description: "Sell food you are carrying.",
		group: "economy",
		options: [
			{
				name: "item",
				description: "What are you selling?",
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
		],
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const resolved = resolveItem(
				typeof ctx.options.item === "string" ? ctx.options.item : "",
				"to sell",
			);
			if (resolved.error) return { embeds: [resolved.error] };
			const { item } = resolved;

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
							title: "🐻 Not enough to sell",
							description: `You only have **${owned}x ${item.name}**.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			deps.economy.removeItem(scope, ctx.user.id, item.id, amount);
			const earned = item.sellPrice * amount;
			const total = deps.economy.addCoins(scope, ctx.user.id, earned, `sold ${item.id} x${amount}`);

			return {
				embeds: [
					{
						title: "💰 Sale complete",
						description: `You sold **${amount}x ${item.emoji} ${item.name}** for ${formatCoins(earned)}.`,
						color: COLORS.honey,
						fields: [{ name: "Coins", value: formatCoins(total), inline: true }],
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	return [shop, buy, sell];
}
