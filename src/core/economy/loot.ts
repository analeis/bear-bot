/** Weighted loot tables for hunting and foraging. */

import type { Item, ItemSource } from "./items.ts";
import { itemsForSource } from "./items.ts";

export interface Loot {
	item: Item;
	qty: number;
}

export interface LootBundle {
	items: Loot[];
	coins: number;
}

const QUANTITY_BY_RARITY = {
	common: [1, 3],
	uncommon: [1, 2],
	rare: [1, 1],
	legendary: [1, 1],
} as const;

/** Picks a single item from a source pool using its weight. */
export function rollItem(source: ItemSource, rng: () => number = Math.random): Item | undefined {
	const pool = itemsForSource(source);
	if (pool.length === 0) return undefined;

	const total = pool.reduce((sum, item) => sum + item.weight, 0);
	let roll = rng() * total;

	for (const item of pool) {
		roll -= item.weight;
		if (roll <= 0) return item;
	}
	return pool[pool.length - 1];
}

/** Rolls an item plus a quantity. */
export function rollLoot(source: ItemSource, rng: () => number = Math.random): Loot | undefined {
	const item = rollItem(source, rng);
	if (!item) return undefined;
	const [min, max] = QUANTITY_BY_RARITY[item.rarity];
	const span = max - min + 1;
	const qty = min + Math.floor(rng() * span);
	return { item, qty };
}

/** Small chance of stumbling over loose coins. */
export function rollCoins(rng: () => number = Math.random): number {
	if (rng() > 0.45) return 0;
	const amount = 5 + Math.floor(rng() * 21);
	return amount;
}

/** A hunt result: one or two items plus optional coins. */
export function rollHunt(rng: () => number = Math.random): LootBundle {
	const items: Loot[] = [];
	const first = rollLoot("hunt", rng);
	if (first) items.push(first);
	if (rng() < 0.35) {
		const second = rollLoot("hunt", rng);
		if (second) items.push(second);
	}
	return { items, coins: rollCoins(rng) };
}

/** A foraging result: always something edible, usually small. */
export function rollForage(rng: () => number = Math.random): LootBundle {
	const items: Loot[] = [];
	const first = rollLoot("forage", rng);
	if (first) items.push(first);
	if (rng() < 0.25) {
		const second = rollLoot("forage", rng);
		if (second) items.push(second);
	}
	return { items, coins: rollCoins(rng) * 0.5 };
}
