import type { Economy } from "./economy/economy.ts";
import type { GifService } from "./gif/service.ts";
import type { CommandRegistry } from "./registry.ts";

/** Services every command can rely on. */
export interface CommandDeps {
	economy: Economy;
	gif: GifService;
	/** Lazily resolves the registry, used by the help command. */
	registry: () => CommandRegistry;
}
