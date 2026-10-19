import { STAMINA_MAX } from "../../../config.ts";
import { scopeKey } from "../../../db/index.ts";
import type { CommandDeps } from "../../deps.ts";
import { DAILY_COINS, DAILY_COOLDOWN_MS } from "../../economy/constants.ts";
import { rollLoot } from "../../economy/loot.ts";
import { COLORS, FOOTER_TEXT, formatCoins, formatDuration } from "../../theme.ts";
import type { CommandDefinition } from "../../types.ts";

export function createWalletCommands(deps: CommandDeps): CommandDefinition[] {
	const balance: CommandDefinition = {
		name: "balance",
		description: "Show your Bear Coins and stamina.",
		group: "economy",
		aliases: ["bal", "coins", "wallet"],
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const user = deps.economy.getUser(scope, ctx.user.id);
			const now = Date.now();
			const dailyReady = now - user.lastDailyAt >= DAILY_COOLDOWN_MS;

			return {
				embeds: [
					{
						title: "🪙 The bear's wallet",
						description: `**${ctx.user.name}**'s stash`,
						color: COLORS.honey,
						fields: [
							{ name: "Bear Coins", value: formatCoins(user.coins), inline: true },
							{
								name: "Stamina",
								value: `${user.stamina} / ${STAMINA_MAX}`,
								inline: true,
							},
							{ name: "Hunts", value: `${user.hunts}`, inline: true },
							{
								name: "Daily reward",
								value: dailyReady
									? "Ready to claim"
									: `Ready in ${formatDuration(user.lastDailyAt + DAILY_COOLDOWN_MS - now)}`,
								inline: true,
							},
						],
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	const daily: CommandDefinition = {
		name: "daily",
		description: "Claim your daily bear reward.",
		group: "economy",
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const user = deps.economy.getUser(scope, ctx.user.id);
			const now = Date.now();
			const elapsed = now - user.lastDailyAt;

			if (user.lastDailyAt > 0 && elapsed < DAILY_COOLDOWN_MS) {
				return {
					embeds: [
						{
							title: "🐻 Not yet",
							description: `The daily honey pot is empty. Come back in **${formatDuration(
								DAILY_COOLDOWN_MS - elapsed,
							)}**.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			const streakBonus =
				user.lastDailyAt > 0 ? Math.min(5, Math.floor(elapsed / DAILY_COOLDOWN_MS)) * 10 : 0;
			const coins = DAILY_COINS + streakBonus;
			const loot = rollLoot("daily");

			deps.economy.addCoins(scope, ctx.user.id, coins, "daily reward");
			deps.economy.markActivity(scope, ctx.user.id, "daily");
			if (loot) deps.economy.addItem(scope, ctx.user.id, loot.item.id, loot.qty);

			const fields = [{ name: "Bear Coins", value: `+${formatCoins(coins)}`, inline: true }];
			if (loot) {
				fields.push({
					name: "Found",
					value: `${loot.item.emoji} ${loot.item.name} x${loot.qty}`,
					inline: true,
				});
			}

			return {
				embeds: [
					{
						title: "🍯 Daily reward",
						description: "The bear keeper leaves a pot of honey on your doorstep.",
						color: COLORS.success,
						fields,
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	const leaderboard: CommandDefinition = {
		name: "leaderboard",
		description: "Show the richest bears.",
		group: "economy",
		aliases: ["top", "lb"],
		options: [
			{
				name: "limit",
				description: "How many bears to show (1-25).",
				type: "integer",
				required: false,
				min: 1,
				max: 25,
				default: 10,
			},
		],
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const raw = ctx.options.limit;
			const limit = typeof raw === "number" ? Math.min(25, Math.max(1, raw)) : 10;
			const rows = deps.economy.leaderboard(scope, limit);

			if (rows.length === 0) {
				return {
					embeds: [
						{
							title: "🐻 Leaderboard",
							description: "No bears have found any coins yet. Be the first!",
							color: COLORS.muted,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			const medals = ["🥇", "🥈", "🥉"];
			const lines = rows.map((row, index) => {
				const medal = medals[index] ?? `${index + 1}.`;
				return `${medal} <@${row.userId}> — ${formatCoins(row.coins)} (${row.hunts} hunts)`;
			});

			return {
				embeds: [
					{
						title: "🐻 Richest bears",
						description: lines.join("\n"),
						color: COLORS.honey,
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	return [balance, daily, leaderboard];
}
