{
	description = "bear-bot — a bear themed chat bot for Discord and Fluxer";

	inputs = {
		nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
	};

	outputs =
		{ self, nixpkgs }:
		let
			systems = [
				"x86_64-linux"
				"aarch64-linux"
				"x86_64-darwin"
				"aarch64-darwin"
			];
			forAllSystems = fn: nixpkgs.lib.genAttrs systems (system: fn nixpkgs.legacyPackages.${system});

			version = "0.1.0";

			# The dependencies are fetched by bun itself. The hash below is a
			# placeholder: the first `nix build .#bear-bot` fails with a hash
			# mismatch and prints the correct value. Paste that value here to
			# make the build reproducible.
			bunDepsHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
		in
		{
			devShells = forAllSystems (pkgs: {
				default = pkgs.mkShell {
					name = "bear-bot-dev";
					packages = with pkgs; [
						bun
						biome
						nodejs
					];
					shellHook = ''
						if [ ! -d node_modules ]; then
							echo "🐻 Installing dependencies with bun..."
							bun install
						fi
						echo "🐻 bear-bot dev shell ready. Use 'bun run dev' to start the bot."
					'';
				};
			});

			packages = forAllSystems (pkgs: rec {
				bear-bot-deps = pkgs.stdenvNoCC.mkDerivation {
					name = "bear-bot-deps";
					src = ./.;
					nativeBuildInputs = [ pkgs.bun ];
					dontConfigure = true;
					dontFixup = true;
					buildPhase = ''
						runHook preBuild
						chmod -R u+w .
						export HOME="$TMPDIR"
						bun install --frozen-lockfile
						runHook postBuild
					'';
					installPhase = ''
						runHook preInstall
						cp -r node_modules $out
						runHook postInstall
					'';
					outputHashMode = "recursive";
					outputHash = bunDepsHash;
				};

				bear-bot = pkgs.stdenvNoCC.mkDerivation {
					pname = "bear-bot";
					inherit version;
					src = ./.;
					nativeBuildInputs = [ pkgs.bun ];
					dontConfigure = true;
					buildPhase = ''
						runHook preBuild
						chmod -R u+w .
						ln -s ${bear-bot-deps} node_modules
						bun build --compile --minify --outfile bear-bot src/index.ts
						runHook postBuild
					'';
					installPhase = ''
						runHook preInstall
						mkdir -p $out/bin
						cp bear-bot $out/bin/bear-bot
						runHook postInstall
					'';
					dontStrip = true;
					meta = {
						description = "A bear themed chat bot for Discord and Fluxer";
						mainProgram = "bear-bot";
						platforms = systems;
					};
				};

				default = bear-bot;
			});

			apps = forAllSystems (pkgs: {
				default = {
					type = "app";
					program = pkgs.writeShellScript "bear-bot" ''
						cd ${self}
						if [ ! -d node_modules ]; then
							${pkgs.bun}/bin/bun install
						fi
						exec ${pkgs.bun}/bin/bun run src/index.ts
					'';
				};
			});

			formatter = forAllSystems (pkgs: pkgs.nixfmt);
		};
}
