/**
 * The bear food catalogue. Prices are in Bear Coins (BC).
 */

export type ItemRarity = "common" | "uncommon" | "rare" | "legendary";

export type ItemSource = "hunt" | "forage" | "daily" | "shop";

export interface Item {
	id: string;
	name: string;
	emoji: string;
	/** Coins needed to buy the item from the shop. */
	buyPrice: number;
	/** Coins gained when selling the item. */
	sellPrice: number;
	/** Stamina restored when the item is eaten. */
	stamina: number;
	description: string;
	rarity: ItemRarity;
	/** Relative chance of finding the item while hunting or foraging. */
	weight: number;
	/** Where the item can be obtained. */
	sources: readonly ItemSource[];
}

export const ITEMS: readonly Item[] = [
	{
		id: "acorn",
		name: "Acorn",
		emoji: "🌰",
		buyPrice: 10,
		sellPrice: 5,
		stamina: 5,
		description: "A crunchy start to any bear's day.",
		rarity: "common",
		weight: 4,
		sources: ["hunt", "forage", "daily", "shop"],
	},
	{
		id: "berries",
		name: "Wild Berries",
		emoji: "🫐",
		buyPrice: 20,
		sellPrice: 11,
		stamina: 10,
		description: "Sticky paws, sweet reward.",
		rarity: "common",
		weight: 5,
		sources: ["hunt", "forage", "daily", "shop"],
	},
	{
		id: "mushrooms",
		name: "Forest Mushrooms",
		emoji: "🍄",
		buyPrice: 30,
		sellPrice: 18,
		stamina: 15,
		description: "Grown in the shade of very old trees.",
		rarity: "common",
		weight: 4,
		sources: ["hunt", "forage", "daily", "shop"],
	},
	{
		id: "trout",
		name: "Trout",
		emoji: "🐠",
		buyPrice: 35,
		sellPrice: 20,
		stamina: 15,
		description: "Slimy, tasty, worth the paws.",
		rarity: "common",
		weight: 4,
		sources: ["hunt", "daily", "shop"],
	},
	{
		id: "salmon",
		name: "Salmon",
		emoji: "🐟",
		buyPrice: 45,
		sellPrice: 28,
		stamina: 20,
		description: "The classic bear currency of the north.",
		rarity: "common",
		weight: 3.5,
		sources: ["hunt", "daily", "shop"],
	},
	{
		id: "honey",
		name: "Honey",
		emoji: "🍯",
		buyPrice: 60,
		sellPrice: 40,
		stamina: 35,
		description: "Golden, sticky and endlessly valuable.",
		rarity: "uncommon",
		weight: 2.5,
		sources: ["hunt", "forage", "daily", "shop"],
	},
	{
		id: "venison",
		name: "Venison",
		emoji: "🥩",
		buyPrice: 90,
		sellPrice: 60,
		stamina: 45,
		description: "A proper meal after a long day's fishing.",
		rarity: "uncommon",
		weight: 1.8,
		sources: ["hunt", "shop"],
	},
	{
		id: "honeycomb",
		name: "Honeycomb",
		emoji: "🍯",
		buyPrice: 120,
		sellPrice: 85,
		stamina: 50,
		description: "Still buzzing. Handle with paws.",
		rarity: "rare",
		weight: 1.1,
		sources: ["hunt", "shop"],
	},
	{
		id: "jerky",
		name: "Bear Jerky",
		emoji: "🍖",
		buyPrice: 150,
		sellPrice: 100,
		stamina: 60,
		description: "The connoisseur's choice. Deeplybeary.",
		rarity: "rare",
		weight: 0.8,
		sources: ["hunt", "shop"],
	},
	{
		id: "paw_charm",
		name: "Bear Paw Charm",
		emoji: "🐾",
		buyPrice: 200,
		sellPrice: 140,
		stamina: 0,
		description: "A charm carved from a lucky paw print.",
		rarity: "rare",
		weight: 0.5,
		sources: ["hunt", "shop"],
	},
	{
		id: "golden_fish",
		name: "Golden Fish",
		emoji: "🐡",
		buyPrice: 400,
		sellPrice: 300,
		stamina: 80,
		description: "Legend says it grants a bear a very good day.",
		rarity: "legendary",
		weight: 0.15,
		sources: ["hunt", "shop"],
	},
	{
		id: "golden_paw",
		name: "Golden Paw Print",
		emoji: "🐾",
		buyPrice: 800,
		sellPrice: 600,
		stamina: 0,
		description: "The holiest of bear artefacts.",
		rarity: "legendary",
		weight: 0.08,
		sources: ["hunt", "shop"],
	},
];

const BY_ID = new Map(ITEMS.map((item) => [item.id, item]));

export function getItem(id: string): Item | undefined {
	return BY_ID.get(id);
}

export function requireItem(id: string): Item {
	const item = BY_ID.get(id);
	if (!item) throw new Error(`Unknown item: ${id}`);
	return item;
}

/** Items that can be found with a given activity. */
export function itemsForSource(source: ItemSource): Item[] {
	return ITEMS.filter((item) => item.sources.includes(source));
}

/** Items that can be bought in the shop. */
export function shopItems(): Item[] {
	return ITEMS.filter((item) => item.sources.includes("shop"));
}

/** Rarity order, from the most common to the most legendary. */
export const RARITY_ORDER: Record<ItemRarity, number> = {
	common: 0,
	uncommon: 1,
	rare: 2,
	legendary: 3,
};

/** Rarity colours used by the economy embeds. */
export const RARITY_COLORS: Record<ItemRarity, number> = {
	common: 0x9ca3af,
	uncommon: 0x4ade80,
	rare: 0x60a5fa,
	legendary: 0xfbbf24,
};

export const RARITY_LABELS: Record<ItemRarity, string> = {
	common: "Common",
	uncommon: "Uncommon",
	rare: "Rare",
	legendary: "Legendary",
};
