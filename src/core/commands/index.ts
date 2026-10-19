import type { CommandDeps } from "../deps.ts";
import type { CommandDefinition } from "../types.ts";
import { createGiveCommand } from "./economy/give.ts";
import { createHuntCommands } from "./economy/hunt.ts";
import { createInventoryCommands } from "./economy/inventory.ts";
import { createShopCommands } from "./economy/shop.ts";
import { createWalletCommands } from "./economy/wallet.ts";
import { createFunCommands } from "./fun.ts";
import { createGifCommand } from "./gif.ts";
import { createHelpCommand } from "./help.ts";

/**
 * Builds the full command list. The same definitions power Discord slash
 * commands and Fluxer prefix commands.
 */
export function createCommands(deps: CommandDeps): CommandDefinition[] {
	return [
		...createFunCommands(deps),
		createGifCommand(deps),
		createHelpCommand(deps),
		...createWalletCommands(deps),
		...createHuntCommands(deps),
		...createInventoryCommands(deps),
		...createShopCommands(deps),
		...createGiveCommand(deps),
	];
}
