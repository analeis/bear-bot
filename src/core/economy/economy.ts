import type { Database } from "bun:sqlite";
import { STAMINA_MAX, STAMINA_REGEN_INTERVAL_MS } from "../../config.ts";
import type { Item } from "./items.ts";
import { getItem, RARITY_ORDER } from "./items.ts";

export interface BearUser {
	scope: string;
	userId: string;
	coins: number;
	stamina: number;
	staminaUpdatedAt: number;
	lastHuntAt: number;
	lastForageAt: number;
	lastDailyAt: number;
	hunts: number;
}

export interface InventoryEntry {
	item: Item;
	qty: number;
}

export interface EconomyOptions {
	staminaMax?: number;
	staminaRegenIntervalMs?: number;
	now?: () => number;
}

/** Row shape of the `bear_users` table. */
interface UserRow {
	coins: number;
	stamina: number;
	stamina_updated_at: number;
	last_hunt_at: number;
	last_forage_at: number;
	last_daily_at: number;
	hunts: number;
}

/**
 * All bear economy state lives here: wallets, stamina, cooldowns and the
 * item inventory. The implementation is deliberately synchronous so command
 * handlers stay simple and atomic.
 */
export class Economy {
	private readonly staminaMax: number;
	private readonly regenIntervalMs: number;
	private readonly now: () => number;

	constructor(
		private readonly db: Database,
		options: EconomyOptions = {},
	) {
		this.staminaMax = options.staminaMax ?? STAMINA_MAX;
		this.regenIntervalMs = options.staminaRegenIntervalMs ?? STAMINA_REGEN_INTERVAL_MS;
		this.now = options.now ?? Date.now;
	}

	/** Loads a bear, creating it on first sight. Stamina regenerates lazily. */
	getUser(scope: string, userId: string): BearUser {
		const now = this.now();
		const row = this.findUser(scope, userId) ?? this.createUser(scope, userId, now);

		const { stamina, staminaUpdatedAt } = this.regenerateStamina(
			scope,
			userId,
			row.stamina,
			row.stamina_updated_at,
			now,
		);

		return {
			scope,
			userId,
			coins: row.coins,
			stamina,
			staminaUpdatedAt,
			lastHuntAt: row.last_hunt_at,
			lastForageAt: row.last_forage_at,
			lastDailyAt: row.last_daily_at,
			hunts: row.hunts,
		};
	}

	/** Reads a bear without creating it. */
	private findUser(scope: string, userId: string): UserRow | null {
		return this.db
			.query(
				`SELECT coins, stamina, stamina_updated_at, last_hunt_at, last_forage_at, last_daily_at, hunts
				 FROM bear_users WHERE guild_id = ? AND user_id = ?`,
			)
			.get(scope, userId) as UserRow | null;
	}

	/** Makes sure a bear exists without loading or regenerating stamina. */
	private ensureUser(scope: string, userId: string): void {
		if (!this.findUser(scope, userId)) this.createUser(scope, userId, this.now());
	}

	/** Creates a bear and returns its row. */
	private createUser(scope: string, userId: string, now: number): UserRow {
		this.db
			.query(
				`INSERT INTO bear_users (guild_id, user_id, coins, stamina, stamina_updated_at, created_at)
				 VALUES (?, ?, 0, ?, ?, ?)`,
			)
			.run(scope, userId, this.staminaMax, now, now);

		const row = this.findUser(scope, userId);
		if (!row) throw new Error("Failed to create bear");
		return row;
	}

	private regenerateStamina(
		scope: string,
		userId: string,
		stamina: number,
		updatedAt: number,
		now: number,
	): { stamina: number; staminaUpdatedAt: number } {
		// A full bear does not need a write: the regeneration clock is reset
		// when stamina is actually spent or restored.
		if (stamina >= this.staminaMax) {
			return { stamina: this.staminaMax, staminaUpdatedAt: updatedAt };
		}

		const elapsed = Math.max(0, now - updatedAt);
		const gained = Math.floor(elapsed / this.regenIntervalMs);
		if (gained <= 0) return { stamina, staminaUpdatedAt: updatedAt };

		const nextStamina = Math.min(this.staminaMax, stamina + gained);
		const nextUpdatedAt = updatedAt + gained * this.regenIntervalMs;
		this.db
			.query(
				"UPDATE bear_users SET stamina = ?, stamina_updated_at = ? WHERE guild_id = ? AND user_id = ?",
			)
			.run(nextStamina, nextUpdatedAt, scope, userId);
		return { stamina: nextStamina, staminaUpdatedAt: nextUpdatedAt };
	}

	/** Adds (or removes) coins and records the movement in the ledger. */
	addCoins(scope: string, userId: string, delta: number, reason: string): number {
		return this.db.transaction(() => this.applyCoins(scope, userId, delta, reason))();
	}

	private applyCoins(scope: string, userId: string, delta: number, reason: string): number {
		this.ensureUser(scope, userId);
		this.db
			.query("UPDATE bear_users SET coins = MAX(0, coins + ?) WHERE guild_id = ? AND user_id = ?")
			.run(delta, scope, userId);
		this.db
			.query(
				"INSERT INTO bear_ledger (guild_id, user_id, delta, reason, created_at) VALUES (?, ?, ?, ?, ?)",
			)
			.run(scope, userId, delta, reason, this.now());
		const row = this.db
			.query("SELECT coins FROM bear_users WHERE guild_id = ? AND user_id = ?")
			.get(scope, userId) as { coins: number };
		return row.coins;
	}

	/** Removes coins, returning false when the bear cannot afford it. */
	spendCoins(scope: string, userId: string, amount: number, reason: string): boolean {
		return this.db.transaction(() => {
			const user = this.getUser(scope, userId);
			if (user.coins < amount) return false;
			this.applyCoins(scope, userId, -amount, reason);
			return true;
		})();
	}

	/** Adds items to the inventory. */
	addItem(scope: string, userId: string, itemId: string, qty: number): void {
		if (qty <= 0) return;
		this.ensureUser(scope, userId);
		this.db
			.query(
				`INSERT INTO bear_inventory (guild_id, user_id, item_id, qty) VALUES (?, ?, ?, ?)
				 ON CONFLICT (guild_id, user_id, item_id) DO UPDATE SET qty = qty + excluded.qty`,
			)
			.run(scope, userId, itemId, qty);
	}

	/** Removes items, returning false when the bear does not have enough. */
	removeItem(scope: string, userId: string, itemId: string, qty: number): boolean {
		if (qty <= 0) return true;
		return this.db.transaction(() => {
			const current = this.getItemQty(scope, userId, itemId);
			if (current < qty) return false;
			this.db
				.query(
					"UPDATE bear_inventory SET qty = qty - ? WHERE guild_id = ? AND user_id = ? AND item_id = ?",
				)
				.run(qty, scope, userId, itemId);
			return true;
		})();
	}

	getItemQty(scope: string, userId: string, itemId: string): number {
		const row = this.db
			.query("SELECT qty FROM bear_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?")
			.get(scope, userId, itemId) as { qty: number } | null;
		return row?.qty ?? 0;
	}

	/** Full inventory, sorted by rarity then name. */
	inventory(scope: string, userId: string): InventoryEntry[] {
		const rows = this.db
			.query(
				`SELECT item_id, qty FROM bear_inventory
				 WHERE guild_id = ? AND user_id = ? AND qty > 0`,
			)
			.all(scope, userId) as { item_id: string; qty: number }[];

		const entries: InventoryEntry[] = [];
		for (const row of rows) {
			const item = getItem(row.item_id);
			if (item) entries.push({ item, qty: row.qty });
		}

		entries.sort((a, b) => {
			// Rarest first.
			const rarity = RARITY_ORDER[b.item.rarity] - RARITY_ORDER[a.item.rarity];
			return rarity !== 0 ? rarity : a.item.name.localeCompare(b.item.name);
		});
		return entries;
	}

	/** Spends stamina, returning false when there is not enough. */
	spendStamina(scope: string, userId: string, amount: number): boolean {
		return this.db.transaction(() => {
			const user = this.getUser(scope, userId);
			if (user.stamina < amount) return false;
			this.db
				.query(
					`UPDATE bear_users SET stamina = stamina - ?, stamina_updated_at = ?
					 WHERE guild_id = ? AND user_id = ?`,
				)
				.run(amount, this.now(), scope, userId);
			return true;
		})();
	}

	/** Restores stamina (capped at the maximum). */
	restoreStamina(scope: string, userId: string, amount: number): number {
		return this.db.transaction(() => {
			const user = this.getUser(scope, userId);
			const next = Math.min(this.staminaMax, user.stamina + amount);
			this.db
				.query(
					`UPDATE bear_users SET stamina = ?, stamina_updated_at = ?
					 WHERE guild_id = ? AND user_id = ?`,
				)
				.run(next, this.now(), scope, userId);
			return next;
		})();
	}

	/** Records the time of the last activity of a given kind. */
	markActivity(scope: string, userId: string, kind: "hunt" | "forage" | "daily"): void {
		const column =
			kind === "hunt" ? "last_hunt_at" : kind === "forage" ? "last_forage_at" : "last_daily_at";
		this.db
			.query(`UPDATE bear_users SET ${column} = ? WHERE guild_id = ? AND user_id = ?`)
			.run(this.now(), scope, userId);
	}

	/** Increments the lifetime hunt counter. */
	incrementHunts(scope: string, userId: string): void {
		this.db
			.query("UPDATE bear_users SET hunts = hunts + 1 WHERE guild_id = ? AND user_id = ?")
			.run(scope, userId);
	}

	/** Richest bears in a scope. */
	leaderboard(scope: string, limit: number): { userId: string; coins: number; hunts: number }[] {
		const rows = this.db
			.query(
				`SELECT user_id, coins, hunts FROM bear_users
				 WHERE guild_id = ? ORDER BY coins DESC, hunts ASC LIMIT ?`,
			)
			.all(scope, limit) as { user_id: string; coins: number; hunts: number }[];
		return rows.map((row) => ({ userId: row.user_id, coins: row.coins, hunts: row.hunts }));
	}
}
