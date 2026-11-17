// Screenshot driver for Void Tide. A `?shot=` query string puts the game into
// a real state of its own code, fast-forwarded with the seeded autopilot, so
// the screenshots are honest renders: start, mid-play, level-up, game over.
//
//   ?shot=start             title screen
//   ?shot=play&seed=7       mid-play on wave 2, enemies and bullets on screen
//   ?shot=upgrade&seed=7    the level-up card choice
//   ?shot=end&seed=7        the game-over screen with real stats
//
// Once the state is reached the simulation freezes (window.__shotReady flips
// true) so the screenshot catches the exact frame.
import { mulberry32 } from './random.js';

const STEP = 1 / 60;

function stepFor(game, input, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    game.update(STEP, input);
    input.endFrame();
    if (game.state === 'gameover' || game.state === 'victory') break;
  }
}

// Called once by main.js after the game boots. Returns true when a shot mode
// was requested (main.js then renders the frozen frame).
export function driveShot(game, input) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  const seed = Number(params.get('seed') || 7);
  game.shotMode = shot;
  game.sfx.muted = true;

  if (shot === 'start') {
    game.state = 'title';
    game.frozen = true;
    window.__shotReady = true;
    return true;
  }

  // Every other shot plays a real seeded run with the autopilot.
  game.rng = mulberry32(seed);
  game.autopilot = true;
  game.start();

  if (shot === 'play') {
    // Step until the arena is busy (wave 3+, 6+ enemies on screen), capped
    // at 45s so the shot is deterministic for the seed.
    let guard = 0;
    while (guard < 60 * 45) {
      game.update(STEP, input);
      input.endFrame();
      guard++;
      if (game.state === 'gameover' || game.state === 'victory') break;
      if (game.wave >= 2 && game.enemies.length >= 5) break;
    }
  } else if (shot === 'upgrade') {
    // Play until the first level-up opens, then hold the choice screen.
    let guard = 0;
    while (game.state !== 'levelup' && guard < 60 * 45) {
      game.update(STEP, input);
      input.endFrame();
      guard++;
      if (game.state === 'gameover' || game.state === 'victory') break;
    }
  } else if (shot === 'end') {
    // No autopilot movement: stand still and let the tide win.
    game.autopilot = false;
    game.player.speed = 0;
    let guard = 0;
    while (game.state !== 'gameover' && guard < 60 * 120) {
      game.update(STEP, input);
      input.endFrame();
      guard++;
      if (game.state === 'victory') break;
    }
  }

  game.frozen = true;
  window.__shotReady = true;
  return true;
}
