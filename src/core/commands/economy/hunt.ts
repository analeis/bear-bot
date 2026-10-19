import { scopeKey } from "../../../db/index.ts";
import type { CommandDeps } from "../../deps.ts";
import {
	FORAGE_COOLDOWN_MS,
	FORAGE_STAMINA_COST,
	HUNT_COOLDOWN_MS,
	HUNT_STAMINA_COST,
} from "../../economy/constants.ts";
import { RARITY_ORDER } from "../../economy/items.ts";
import { rollForage, rollHunt } from "../../economy/loot.ts";
import { COLORS, FOOTER_TEXT, formatCoins, formatDuration } from "../../theme.ts";
import type { BotEmbed, CommandDefinition } from "../../types.ts";

const HUNT_SCENES: readonly string[] = [
	"You tracked a line through the ferns and waited by the river until the water broke.",
	"You climbed a deadfall, nose downwind, and froze when something rustled ahead.",
	"The river was loud, so you splashed, swore at the current, and won anyway.",
	"You spent an hour in a blueberry patch pretending to be a very large berry.",
	"Snow crunched under your belly pads. You did not care. The salmon was worth it.",
];

const FORAGE_SCENES: readonly string[] = [
	"You turned over a rotting log and found a whole colony of mushrooms.",
	"You worked the edge of the meadow, picking the berries one careful paw at a time.",
	"A bee buzzed past your nose. You pretended not to notice the honeycomb.",
	"You found a patch of wild berries hiding under the bracken.",
	"Acorns, everywhere acorns. You filled your paws anyway.",
];

const RARE_SCENES: readonly string[] = [
	"Holy smoke. That was no ordinary fish.",
	"The paw print gleamed. You are holding history in your hands.",
	"You found a honeycomb the size of both paws. It is still humming.",
];

export function createHuntCommands(deps: CommandDeps): CommandDefinition[] {
	const hunt: CommandDefinition = {
		name: "hunt",
		description: "Hunt for fish, meat and other bear food.",
		group: "economy",
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const user = deps.economy.getUser(scope, ctx.user.id);
			const now = Date.now();

			const sinceHunt = now - user.lastHuntAt;
			if (user.lastHuntAt > 0 && sinceHunt < HUNT_COOLDOWN_MS) {
				return {
					embeds: [
						{
							title: "🐻 Still hunting",
							description: `You need to rest. The next hunt is ready in **${formatDuration(
								HUNT_COOLDOWN_MS - sinceHunt,
							)}**.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			if (user.stamina < HUNT_STAMINA_COST) {
				return {
					embeds: [
						{
							title: "🐻 Too tired",
							description: `A hunt costs **${HUNT_STAMINA_COST} stamina** and you have **${user.stamina}**. Eat something, or wait for your stamina to come back.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			deps.economy.spendStamina(scope, ctx.user.id, HUNT_STAMINA_COST);
			deps.economy.markActivity(scope, ctx.user.id, "hunt");
			deps.economy.incrementHunts(scope, ctx.user.id);

			const result = rollHunt();
			for (const loot of result.items) {
				deps.economy.addItem(scope, ctx.user.id, loot.item.id, loot.qty);
			}
			if (result.coins > 0) {
				deps.economy.addCoins(scope, ctx.user.id, result.coins, "hunt");
			}

			const bestRarity = result.items.reduce<keyof typeof RARITY_ORDER>(
				(acc, loot) =>
					RARITY_ORDER[loot.item.rarity] > RARITY_ORDER[acc] ? loot.item.rarity : acc,
				"common",
			);

			const scene =
				bestRarity === "legendary" || bestRarity === "rare"
					? (RARE_SCENES[Math.floor(Math.random() * RARE_SCENES.length)] as string)
					: (HUNT_SCENES[Math.floor(Math.random() * HUNT_SCENES.length)] as string);

			const fields = result.items.map((loot) => ({
				name: loot.item.name,
				value: `${loot.item.emoji} x${loot.qty} — sells for ${formatCoins(
					loot.item.sellPrice * loot.qty,
				)}`,
				inline: true,
			}));
			if (result.coins > 0) {
				fields.push({
					name: "Coins found",
					value: `+${formatCoins(result.coins)}`,
					inline: true,
				});
			}

			const embed: BotEmbed = {
				title: "🐻 Hunt complete",
				description: scene,
				color: COLORS.primary,
				fields,
				footer: { text: FOOTER_TEXT },
			};

			return { embeds: [embed] };
		},
	};

	const forage: CommandDefinition = {
		name: "forage",
		description: "Gather berries, mushrooms and acorns.",
		group: "economy",
		async run(ctx) {
			const scope = scopeKey(ctx.guildId);
			const user = deps.economy.getUser(scope, ctx.user.id);
			const now = Date.now();

			const sinceForage = now - user.lastForageAt;
			if (user.lastForageAt > 0 && sinceForage < FORAGE_COOLDOWN_MS) {
				return {
					embeds: [
						{
							title: "🐻 Still foraging",
							description: `The patch is picked clean. Try again in **${formatDuration(
								FORAGE_COOLDOWN_MS - sinceForage,
							)}**.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			if (user.stamina < FORAGE_STAMINA_COST) {
				return {
					embeds: [
						{
							title: "🐻 Too tired",
							description: `Foraging costs **${FORAGE_STAMINA_COST} stamina** and you have **${user.stamina}**. Have a snack first.`,
							color: COLORS.error,
							footer: { text: FOOTER_TEXT },
						},
					],
				};
			}

			deps.economy.spendStamina(scope, ctx.user.id, FORAGE_STAMINA_COST);
			deps.economy.markActivity(scope, ctx.user.id, "forage");

			const result = rollForage();
			for (const loot of result.items) {
				deps.economy.addItem(scope, ctx.user.id, loot.item.id, loot.qty);
			}
			if (result.coins > 0) {
				deps.economy.addCoins(scope, ctx.user.id, Math.round(result.coins), "forage");
			}

			const scene = FORAGE_SCENES[Math.floor(Math.random() * FORAGE_SCENES.length)] as string;

			return {
				embeds: [
					{
						title: "🫐 Forage complete",
						description: scene,
						color: COLORS.success,
						fields: result.items.map((loot) => ({
							name: loot.item.name,
							value: `${loot.item.emoji} x${loot.qty}`,
							inline: true,
						})),
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	return [hunt, forage];
}
