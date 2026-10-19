import type { Item } from "../economy/items.ts";
import { ITEMS } from "../economy/items.ts";
import { COLORS, FOOTER_TEXT } from "../theme.ts";
import type { BotEmbed } from "../types.ts";

/**
 * Resolves an item from user input. Accepts ids (`salmon`), names
 * (`Wild Berries`), underscored names (`wild_berries`) and emojis.
 */
export function findItem(query: string | undefined): Item | undefined {
	if (!query) return undefined;
	const needle = query.trim().toLowerCase();
	if (needle.length === 0) return undefined;

	const exact = ITEMS.find(
		(item) =>
			item.id === needle ||
			item.emoji === needle ||
			item.name.toLowerCase() === needle ||
			item.name.toLowerCase().replace(/\s+/g, "_") === needle ||
			item.name.toLowerCase().replace(/\s+/g, "-") === needle,
	);
	if (exact) return exact;

	return ITEMS.find((item) => item.name.toLowerCase().includes(needle) || item.id.includes(needle));
}

/** Human readable list of item names, used in error messages. */
export function itemNameList(): string {
	return ITEMS.map((item) => item.id).join(", ");
}

/** Either the resolved item, or an embed explaining that it does not exist. */
export type ItemResolution =
	| { item: Item; error?: undefined }
	| { item?: undefined; error: BotEmbed };

/**
 * Resolves an item for a command and produces a consistent error embed when
 * the bear asked for something that is not on the menu.
 *
 * @param query - Raw user input.
 * @param action - Phrase describing the action, e.g. `"to buy"`.
 */
export function resolveItem(query: string | undefined, action: string): ItemResolution {
	const item = findItem(query);
	if (item) return { item };

	const name = query?.trim() ? `**${query.trim()}**` : "that";
	return {
		error: {
			title: "🐻 Unknown item",
			description: `There is no ${name} ${action}. Try one of: ${itemNameList()}.`,
			color: COLORS.error,
			footer: { text: FOOTER_TEXT },
		},
	};
}
