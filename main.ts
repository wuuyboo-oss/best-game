// Void Tide — the entry program (Node 22, standard library only). It hands the
// game in: the static game/ folder and the screenshots/ folder are copied from
// beside this file into the output directory, and dossier.json is written there
// with the vendored make.fun library, which also reads the game back and
// describes it for the judge. The program writes the same bytes on every run:
// it copies files and builds the dossier, nothing more.
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps, so this program refuses an entry the scorer would
// refuse instead of handing it in: at most 4 screenshots of 256 KiB each,
// game/ at most 993 files and 48 MiB with no path over 1000 bytes, and the
// dossier's text capped at 160 KiB.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
