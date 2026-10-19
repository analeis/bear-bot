import { describe, expect, test } from "bun:test";
import { toDiscordCommand } from "../src/platforms/discord.ts";
import { extractUserId, parseInvocation, parseOptions } from "../src/platforms/fluxer.ts";
import { createHarness, describeResponse, run } from "./helpers.ts";

describe("command registry", () => {
	test("every command has a name, description and group", () => {
		const { registry } = createHarness();
		for (const definition of registry.list()) {
			expect(definition.name.length).toBeGreaterThan(0);
			expect(definition.description.length).toBeGreaterThan(0);
			expect(["fun", "economy"]).toContain(definition.group);
		}
	});

	test("unknown commands produce an error embed", async () => {
		const { registry } = createHarness();
		const response = await run(registry, "nope");
		expect(describeResponse(response)).toContain("does not exist");
	});

	test("aliases resolve to the same command", async () => {
		const { registry } = createHarness();
		expect(registry.get("bal")?.name).toBe("balance");
		expect(registry.get("inv")?.name).toBe("inventory");
	});

	test("the help command lists the commands", async () => {
		const { registry } = createHarness();
		const response = await run(registry, "help");
		const text = describeResponse(response);
		expect(text).toContain("/hunt");
		expect(text).toContain("/fact");
	});

	test("the help command adapts to the platform", async () => {
		const { registry } = createHarness();
		const response = await run(registry, "help", {}, { platform: "fluxer" });
		expect(describeResponse(response)).toContain("!bear hunt");
	});
});

describe("discord command registration", () => {
	test("commands stay inside the discord limits", () => {
		const { registry } = createHarness();
		const namePattern = /^[-_\p{L}\p{N}]{1,32}$/u;

		expect(registry.list().length).toBeLessThanOrEqual(100);

		for (const definition of registry.list()) {
			expect(definition.name).toMatch(namePattern);
			expect(definition.description.length).toBeGreaterThan(0);
			expect(definition.description.length).toBeLessThanOrEqual(100);
			expect(definition.options?.length ?? 0).toBeLessThanOrEqual(25);

			for (const option of definition.options ?? []) {
				expect(option.name).toMatch(namePattern);
				expect(option.description.length).toBeGreaterThan(0);
				expect(option.description.length).toBeLessThanOrEqual(100);
			}
		}
	});

	test("commands are converted to the discord shape", () => {
		const { registry } = createHarness();
		const buy = registry.get("buy");
		if (!buy) throw new Error("buy command is missing");

		const body = toDiscordCommand(buy);
		expect(body.name).toBe("buy");
		expect(body.options?.length).toBe(2);
		expect(body.options?.[0]?.name).toBe("item");
		expect(body.options?.[0]?.type).toBe(3);
		expect(body.options?.[1]?.type).toBe(4);
	});
});

describe("fluxer prefix parsing", () => {
	test("the namespace is optional", () => {
		expect(parseInvocation("!bear hunt", "!")).toEqual({
			name: "hunt",
			args: [],
			namespaceOnly: false,
		});
		expect(parseInvocation("!hunt", "!")).toEqual({
			name: "hunt",
			args: [],
			namespaceOnly: false,
		});
		expect(parseInvocation("!bear buy salmon 2", "!")).toEqual({
			name: "buy",
			args: ["salmon", "2"],
			namespaceOnly: false,
		});
	});

	test("the bare namespace is recognised", () => {
		expect(parseInvocation("!bear", "!")).toEqual({
			name: "bear",
			args: [],
			namespaceOnly: true,
		});
	});

	test("messages without the prefix are ignored", () => {
		expect(parseInvocation("hello there", "!")).toBeNull();
	});

	test("positional arguments map onto options", () => {
		const { registry } = createHarness();
		const buy = registry.get("buy");
		if (!buy) throw new Error("buy command is missing");

		const options = parseOptions(["salmon", "3"], buy);
		expect(options.item).toBe("salmon");
		expect(options.amount).toBe(3);
	});

	test("free text options capture the rest of the line", () => {
		const { registry } = createHarness();
		const fortune = registry.get("fortune");
		if (!fortune) throw new Error("fortune command is missing");

		const options = parseOptions(["will", "it", "rain", "tomorrow"], fortune);
		expect(options.question).toBe("will it rain tomorrow");
	});

	test("a prefix message runs the command end to end", async () => {
		const { economy, registry } = createHarness();
		economy.addCoins("guild-1", "user-1", 500, "test");

		const invocation = parseInvocation("!bear buy salmon 2", "!");
		if (!invocation) throw new Error("invocation was not parsed");

		const definition = registry.get(invocation.name);
		if (!definition) throw new Error("command was not found");

		const options = parseOptions(invocation.args, definition);
		const response = await run(registry, definition.name, options, { platform: "fluxer" });

		expect(describeResponse(response)).toContain("Purchase complete");
		expect(economy.getItemQty("guild-1", "user-1", "salmon")).toBe(2);
	});

	test("user mentions are converted to ids", () => {
		expect(extractUserId("<@123456789>")).toBe("123456789");
		expect(extractUserId("<@!123456789>")).toBe("123456789");
		expect(extractUserId("123456789")).toBe("123456789");
		expect(extractUserId("not-an-id")).toBeUndefined();
	});
});
