import { randomFact } from "../content/facts.ts";
import { randomJoke } from "../content/jokes.ts";
import type { CommandDeps } from "../deps.ts";
import { COLORS, FOOTER_TEXT } from "../theme.ts";
import type { CommandDefinition } from "../types.ts";

const FORTUNES: readonly string[] = [
	"The forest is on your side today. Go forage.",
	"A salmon is watching you. It wants to be caught.",
	"Honey is worth more than gold this week. Invest.",
	"Your fortune: a bear's belly is a clock, and yours says snack time.",
	"A rival bear is watching your stash. Spend your coins quickly.",
	"The trout are biting. Bring a sharp claw.",
	"Fortune favours the bold. Fortify the den.",
	"You will find honey within three days of asking.",
	"A storm is coming: stay in the den and eat your reserves.",
	"A visitor will bring you a gift of berries.",
	"Your next hunt will be legendary. Probably.",
	"Someone in the den owes you coins. Ask about it.",
	"The bees are calm today. A good day for honey.",
	"Two bears are talking about you. It is not gossip, it is planning.",
	"Patience pays. So does a very large salmon.",
	"Your stamina is low. Rest, or eat something with honey in it.",
	"A friendly bear will trade with you soon.",
	"Do not trust a raccoon with your acorns.",
	"Luck favours the bear who checks the daily reward.",
	"The moon is full. The salmon are jumping.",
];

function randomFortune(rng: () => number = Math.random): string {
	const index = Math.floor(rng() * FORTUNES.length) % FORTUNES.length;
	return FORTUNES[index] as string;
}

export function createFunCommands(_deps: CommandDeps): CommandDefinition[] {
	const fact: CommandDefinition = {
		name: "fact",
		description: "Share a random fact about bears.",
		group: "fun",
		async run() {
			return {
				embeds: [
					{
						title: "🐻 Bear fact",
						description: randomFact(),
						color: COLORS.primary,
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	const joke: CommandDefinition = {
		name: "joke",
		description: "Tell a bear joke. Handle with paws.",
		group: "fun",
		async run() {
			return {
				embeds: [
					{
						title: "🐻 Bear joke",
						description: randomJoke(),
						color: COLORS.honey,
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	const fortune: CommandDefinition = {
		name: "fortune",
		description: "Ask the bears what the future holds.",
		group: "fun",
		options: [
			{
				name: "question",
				description: "What do you want to know?",
				type: "string",
				required: false,
				rest: true,
			},
		],
		async run(ctx) {
			const question = ctx.options.question;
			const prefix =
				typeof question === "string" && question.trim().length > 0
					? `**${question.trim()}**\n`
					: "";
			return {
				embeds: [
					{
						title: "🔮 The oracle bear speaks",
						description: `${prefix}${randomFortune()}`,
						color: COLORS.info,
						footer: { text: FOOTER_TEXT },
					},
				],
			};
		},
	};

	return [fact, joke, fortune];
}
