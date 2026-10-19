import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite storage. Bear-bot keeps everything in a single file so it can be
 * deployed as a plain container with no external database to operate.
 */

const SCHEMA = `
CREATE TABLE IF NOT EXISTS bear_users (
	guild_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	coins INTEGER NOT NULL DEFAULT 0,
	stamina INTEGER NOT NULL DEFAULT 100,
	stamina_updated_at INTEGER NOT NULL DEFAULT 0,
	last_hunt_at INTEGER NOT NULL DEFAULT 0,
	last_forage_at INTEGER NOT NULL DEFAULT 0,
	last_daily_at INTEGER NOT NULL DEFAULT 0,
	hunts INTEGER NOT NULL DEFAULT 0,
	created_at INTEGER NOT NULL,
	PRIMARY KEY (guild_id, user_id)
);

CREATE TABLE IF NOT EXISTS bear_inventory (
	guild_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	item_id TEXT NOT NULL,
	qty INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY (guild_id, user_id, item_id)
);

CREATE TABLE IF NOT EXISTS bear_ledger (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	guild_id TEXT NOT NULL,
	user_id TEXT NOT NULL,
	delta INTEGER NOT NULL,
	reason TEXT NOT NULL,
	created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS bear_ledger_user ON bear_ledger (guild_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bear_users_coins ON bear_users (guild_id, coins DESC);
`;

/** Opens (and migrates) the bear-bot database. */
export function openDatabase(path: string): Database {
	if (path !== ":memory:") {
		mkdirSync(dirname(path), { recursive: true });
	}

	const db = new Database(path, { create: true });
	db.exec("PRAGMA journal_mode = WAL;");
	db.exec("PRAGMA foreign_keys = ON;");
	db.exec("PRAGMA busy_timeout = 5000;");
	db.exec(SCHEMA);
	return db;
}

/**
 * Economy scope. Guild economies are kept separate so servers do not share
 * wallets; DMs use a dedicated scope.
 */
export function scopeKey(guildId: string | undefined): string {
	return guildId ?? "dm";
}
