# 🐻 bear-bot

A bear themed chat bot that runs on **Discord** and **Fluxer** from a single
codebase, written in TypeScript on Bun.

Bear-bot is a cat-bot for bears: it tells bear facts, bear jokes and bear GIFs,
and it runs a small economy where bears hunt, forage, trade, and hoard
honey.

```
/hunt     →  You catch 2x Salmon and 14 BC
/gif      →  🐻 bear GIF
/shop     →  🪙 The bear market
```

## Highlights

- **One command registry, two platforms.** Commands are declared once in
  `src/core/commands` and are exposed as real Discord application commands
  (slash commands, as Discord's policy requires) and as Fluxer prefix
  commands.
- **Slash commands on Discord.** No message content intent, no prefix
  commands, no privileged intents.
- **A real economy.** Coins, stamina, cooldowns, a food catalogue, a market,
  trading between bears and a daily reward, all persisted in SQLite.
- **Self contained.** One SQLite file, no external services. A GIF backend is
  used when configured, otherwise a keyless fallback keeps `/gif` working.
- **Deployable anywhere.** Dockerfile, compose file and a Nix flake are
  included.

## Commands

| Command                        | Group   | What it does                                               |
| ------------------------------ | ------- | ---------------------------------------------------------- |
| `/fact`                        | fun     | A random fact about bears                                  |
| `/joke`                        | fun     | A bear joke                                                |
| `/fortune [question]`          | fun     | The oracle bear answers                                    |
| `/gif [query]`                 | fun     | Fetches a bear GIF (defaults to `bear`)                    |
| `/help [command]`              | fun     | Command list, or details for one command                   |
| `/balance`                     | economy | Coins, stamina and hunt count                              |
| `/hunt`                        | economy | Hunt for fish and meat (25 stamina, 5 min cooldown)        |
| `/forage`                      | economy | Gather berries and mushrooms (10 stamina, 10 min cooldown) |
| `/inventory`                   | economy | What you are carrying                                      |
| `/shop [item]`                 | economy | The market prices                                          |
| `/buy <item> [amount]`         | economy | Buy food                                                   |
| `/sell <item> [amount]`        | economy | Sell food                                                  |
| `/give <item> [amount] <user>` | economy | Gift food to another bear                                  |
| `/eat <item>`                  | economy | Eat food to restore stamina                                |
| `/daily`                       | economy | Daily reward (24 h cooldown)                               |
| `/leaderboard [limit]`         | economy | The richest bears in the server                            |

On Fluxer the same commands are reachable as `!bear hunt`, `!bear buy salmon 2`
and so on. `!hunt` without the namespace also works.

### The economy

Bears earn **Bear Coins (BC)** and spend them on food. Every bear has 100
stamina that regenerates over time; hunting and foraging cost stamina, and
eating food restores it.

| Item                | Buy | Sell | Stamina | Rarity    |
| ------------------- | --- | ---- | ------- | --------- |
| 🌰 Acorn            | 10  | 5    | 5       | common    |
| 🫐 Wild Berries     | 20  | 11   | 10      | common    |
| 🍄 Forest Mushrooms | 30  | 18   | 15      | common    |
| 🐠 Trout            | 35  | 20   | 15      | common    |
| 🐟 Salmon           | 45  | 28   | 20      | common    |
| 🍯 Honey            | 60  | 40   | 35      | uncommon  |
| 🥩 Venison          | 90  | 60   | 45      | uncommon  |
| 🍯 Honeycomb        | 120 | 85   | 50      | rare      |
| 🍖 Bear Jerky       | 150 | 100  | 60      | rare      |
| 🐾 Bear Paw Charm   | 200 | 140  | –       | rare      |
| 🐡 Golden Fish      | 400 | 300  | 80      | legendary |
| 🐾 Golden Paw Print | 800 | 600  | –       | legendary |

Each server has its own economy; DMs use a separate scope.

## Platform support

| Platform | Command style   | Notes                                                                                                                                                                                                            |
| -------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Discord  | Slash commands  | Real application commands, registered on startup. Set `DISCORD_GUILD_ID` to register them to one guild while developing.                                                                                         |
| Fluxer   | Prefix commands | Fluxer's API has no interaction (slash command) endpoints yet, so the same command definitions are exposed as `!bear <command>`. When Fluxer ships interactions, only `src/platforms/fluxer.ts` needs to change. |

Both platforms can run at the same time from one process; each is enabled by
setting its token.

## Setup

```bash
bun install
cp .env.example .env   # then fill in the tokens you need
bun run dev            # start the bot with file watching
```

Only one of `DISCORD_TOKEN` and `FLUXER_TOKEN` is required — bear-bot starts
whichever platforms it has credentials for.

### Environment

| Variable                    | Default              | Meaning                                    |
| --------------------------- | -------------------- | ------------------------------------------ |
| `DISCORD_TOKEN`             | –                    | Discord bot token                          |
| `DISCORD_APPLICATION_ID`    | looked up            | Discord application id                     |
| `DISCORD_GUILD_ID`          | –                    | Register commands to this guild only (dev) |
| `FLUXER_TOKEN`              | –                    | Fluxer bot token                           |
| `FLUXER_PREFIX`             | `!`                  | Prefix for Fluxer commands                 |
| `FLUXER_API_URL`            | hosted               | Self-hosted Fluxer instance                |
| `DATABASE_PATH`             | `./data/bear-bot.db` | SQLite file                                |
| `KLIPY_APP_KEY`             | –                    | Klipy GIF API key                          |
| `TENOR_API_KEY`             | –                    | Tenor GIF API key                          |
| `GIPHY_API_KEY`             | –                    | Giphy GIF API key                          |
| `GIF_CUSTOMER_ID`           | `bear-bot`           | Customer id passed to the GIF APIs         |
| `STAMINA_MAX`               | `100`                | Maximum stamina                            |
| `STAMINA_REGEN_INTERVAL_MS` | `60000`              | Milliseconds per stamina point             |
| `LOG_LEVEL`                 | `info`               | `debug`, `info`, `warn` or `error`         |

Without a GIF API key, `/gif` falls back to a keyless Giphy search, so the
command works out of the box.

## Deployment

### Docker

```bash
docker compose up -d --build
```

The compose file reads `.env` and keeps the SQLite database in the
`bear-bot-data` volume.

### Nix

```bash
nix develop            # dev shell with bun, biome and node
nix run .              # run the bot from the working tree
nix build .#bear-bot   # build a single self contained binary
```

The first `nix build` needs the dependency hash: Nix will report a hash
mismatch and print the correct value, which you paste into `bunDepsHash` in
`flake.nix`.

## Development

```bash
bun run typecheck   # tsc via bun check
bun run lint        # biome check --write
bun run format      # biome format --write
bun test            # unit tests
```

`bun run lint` rewrites files, `bun run lint:check` only reports problems and
is what CI uses.

### Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:
- **check** — `bun install --frozen-lockfile`, typecheck, `biome ci` and the
  unit tests.
- **docker** — builds the image, so a broken `Dockerfile` fails the build
  instead of the deploy.

CI tracks the latest Bun release rather than pinning a version; the committed
`bun.lock` keeps every job on the same dependency tree.

The Nix flake is not part of CI: its dependency hash has to be filled in once
(see above) and a build job would fail on a fresh checkout until that
happens. Dependabot keeps Bun, GitHub Actions and the Docker base image up to
date.

### Layout

```
src/
  index.ts              entry point, wires platforms and services together
  config.ts             environment configuration
  core/
    types.ts            shared command and embed types
    registry.ts         command registry and dispatch
    theme.ts            colours, formatting helpers
    logger.ts           leveled logger
    commands/           the commands themselves
      fun.ts            fact, joke, fortune
      gif.ts            gif
      help.ts           help
      item-lookup.ts    item name resolution shared by the economy commands
      economy/          balance, daily, leaderboard, hunt, forage,
                        inventory, eat, shop, buy, sell, give
    economy/            item catalogue, loot tables, economy engine
    content/            bear facts and jokes
    gif/                GIF providers
  db/                   SQLite schema and connection
  platforms/
    discord.ts          Discord slash command adapter
    fluxer.ts           Fluxer prefix command adapter
tests/                  unit tests
```

Platform adapters translate native payloads (Discord interactions, Fluxer
messages) into a shared `CommandContext`, and shared embeds back into the
platform's own format. Nothing under `src/core` imports Discord or Fluxer
code, which is what keeps the bot portable.
