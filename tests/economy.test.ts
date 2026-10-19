import { describe, expect, test } from "bun:test";
import { createHarness, describeResponse, run } from "./helpers.ts";

describe("bear economy", () => {
	test("a hunt costs stamina and yields loot", async () => {
		const { economy, registry } = createHarness();
		const before = economy.getUser("guild-1", "user-1");

		const response = await run(registry, "hunt");
		const text = describeResponse(response);

		expect(text).toContain("Hunt complete");
		const after = economy.getUser("guild-1", "user-1");
		expect(after.stamina).toBe(before.stamina - 25);
		expect(after.hunts).toBe(1);
		expect(economy.inventory("guild-1", "user-1").length).toBeGreaterThan(0);
	});

	test("hunting twice in a row hits the cooldown", async () => {
		const { registry } = createHarness();

		await run(registry, "hunt");
		const second = await run(registry, "hunt");

		expect(describeResponse(second)).toContain("Still hunting");
	});

	test("buying and selling moves coins and items", async () => {
		const { economy, registry } = createHarness();
		economy.addCoins("guild-1", "user-1", 500, "test");

		const buy = await run(registry, "buy", { item: "salmon", amount: 2 });
		expect(describeResponse(buy)).toContain("Purchase complete");
		expect(economy.getItemQty("guild-1", "user-1", "salmon")).toBe(2);
		expect(economy.getUser("guild-1", "user-1").coins).toBe(500 - 45 * 2);

		const sell = await run(registry, "sell", { item: "salmon", amount: 2 });
		expect(describeResponse(sell)).toContain("Sale complete");
		expect(economy.getItemQty("guild-1", "user-1", "salmon")).toBe(0);
		expect(economy.getUser("guild-1", "user-1").coins).toBe(500 - 45 * 2 + 28 * 2);
	});

	test("buying without coins is refused", async () => {
		const { registry } = createHarness();

		const response = await run(registry, "buy", { item: "golden_paw" });
		expect(describeResponse(response)).toContain("Not enough coins");
	});

	test("unknown items are reported", async () => {
		const { registry } = createHarness();

		const response = await run(registry, "buy", { item: "dragon" });
		expect(describeResponse(response)).toContain("Unknown item");
		expect(describeResponse(response)).toContain("to buy");
	});

	test("eating food restores stamina", async () => {
		const { economy, registry } = createHarness();
		economy.addItem("guild-1", "user-1", "honey", 1);
		economy.spendStamina("guild-1", "user-1", 80);

		const response = await run(registry, "eat", { item: "honey" });
		expect(describeResponse(response)).toContain("Nom");
		expect(economy.getUser("guild-1", "user-1").stamina).toBe(55);
		expect(economy.getItemQty("guild-1", "user-1", "honey")).toBe(0);
	});

	test("giving transfers items to another bear", async () => {
		const { economy, registry } = createHarness();
		economy.addItem("guild-1", "user-1", "berries", 3);

		const response = await run(registry, "give", {
			item: "berries",
			amount: 2,
			user: "user-2",
		});
		expect(describeResponse(response)).toContain("Gift delivered");
		expect(economy.getItemQty("guild-1", "user-1", "berries")).toBe(1);
		expect(economy.getItemQty("guild-1", "user-2", "berries")).toBe(2);
	});

	test("the daily reward can only be claimed once a day", async () => {
		const { economy, registry } = createHarness();

		const first = await run(registry, "daily");
		expect(describeResponse(first)).toContain("Daily reward");
		expect(economy.getUser("guild-1", "user-1").coins).toBeGreaterThan(0);

		const second = await run(registry, "daily");
		expect(describeResponse(second)).toContain("Not yet");
	});

	test("economies are isolated per guild", async () => {
		const { economy, registry } = createHarness();
		economy.addCoins("guild-1", "user-1", 100, "test");

		const response = await run(registry, "balance", {}, { guildId: "guild-2" });
		expect(describeResponse(response)).toContain("0 BC");
	});

	test("the leaderboard ranks the richest bears", async () => {
		const { economy, registry } = createHarness();
		economy.addCoins("guild-1", "user-1", 900, "test");
		economy.addCoins("guild-1", "user-2", 100, "test");

		const response = await run(registry, "leaderboard");
		const text = describeResponse(response);
		expect(text).toContain("Richest bears");
		expect(text.indexOf("user-1")).toBeLessThan(text.indexOf("user-2"));
	});
});

describe("inventory order", () => {
	test("the rarest items come first", async () => {
		const { economy, registry } = createHarness();
		economy.addItem("guild-1", "user-1", "acorn", 1);
		economy.addItem("guild-1", "user-1", "golden_fish", 1);
		economy.addItem("guild-1", "user-1", "honeycomb", 1);
		economy.addItem("guild-1", "user-1", "salmon", 1);

		const response = await run(registry, "inventory");
		const text = describeResponse(response);
		expect(text.indexOf("Golden Fish")).toBeLessThan(text.indexOf("Honeycomb"));
		expect(text.indexOf("Honeycomb")).toBeLessThan(text.indexOf("Salmon"));
	});
});

describe("stamina clock", () => {
	test("spending stamina does not grant back the points already earned", async () => {
		let now = 1_700_000_000_000;
		const { economy, registry } = createHarness({
			now: () => now,
		});

		expect(economy.getUser("guild-1", "user-1").stamina).toBe(100);

		// One minute later a point has regenerated, capped at the maximum.
		now += 60_000;
		await run(registry, "hunt");
		expect(economy.getUser("guild-1", "user-1").stamina).toBe(75);

		// Another minute buys exactly one more point.
		now += 60_000;
		expect(economy.getUser("guild-1", "user-1").stamina).toBe(76);
	});

	test("eating resets the regeneration clock", async () => {
		let now = 1_700_000_000_000;
		const { economy, registry } = createHarness({
			now: () => now,
		});
		economy.addItem("guild-1", "user-1", "honey", 1);

		now += 60_000;
		await run(registry, "hunt");
		now += 60_000;
		await run(registry, "eat", { item: "honey" });

		// 75 stamina, one point of regen, then 35 from the honey.
		expect(economy.getUser("guild-1", "user-1").stamina).toBe(100);
	});
});
