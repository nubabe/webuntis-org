# Builds `webuntis-org` as a wrapper around `tsx src/timetable.ts` — there's no compile step,
# the script runs straight from TypeScript source, so we skip npm's build phase entirely
# and just wrap the already-resolved `tsx` bin with its runtime deps (node, emacs) on PATH.
{
  lib,
  buildNpmPackage,
  nodejs,
  emacs,
  makeWrapper,
}:
buildNpmPackage {
  pname = "webuntis-org";
  version = "1.0.0";

  src = ./.;

  npmDepsHash = "sha256-K/1Tc0Ibwydg9eb2ijZwIflC61HCu2ciRUJ6H1vBorw=";

  dontNpmBuild = true;

  nativeBuildInputs = [ makeWrapper ];

  installPhase = ''
    runHook preInstall

    mkdir -p "$out/lib/webuntis-org"
    cp -r . "$out/lib/webuntis-org"

    mkdir -p "$out/bin"
    makeWrapper "$out/lib/webuntis-org/node_modules/.bin/tsx" "$out/bin/webuntis-org" \
      --add-flags "$out/lib/webuntis-org/src/timetable.ts" \
      --prefix PATH : ${lib.makeBinPath [ nodejs emacs ]}

    runHook postInstall
  '';

  meta = {
    description = "Fetch a WebUntis timetable into an org-mode file, with rule-based tagging/filtering and reproducible manual edits";
    homepage = "https://github.com/nubabe/webuntis-org";
    mainProgram = "webuntis-org";
    platforms = lib.platforms.unix;
  };
}
