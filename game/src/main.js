// Boot and frame loop for Void Tide. Fixed-timestep updates (60 Hz) with an
// accumulator, so the game plays the same on any display; rendering scales the
// 1280x720 arena to fit the window.
import { CFG } from './config.js';
import { Game } from './world.js';
import { Input } from './input.js';
import { drawGame } from './render.js';
import { driveShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  const scale = Math.min(canvas.width / CFG.W, canvas.height / CFG.H);
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - CFG.W * scale) / 2, (canvas.height - CFG.H * scale) / 2);
}

fitCanvas();
window.addEventListener('resize', fitCanvas);

const input = new Input(canvas);
const seed = (Date.now() % 2147483647) >>> 0;
const game = new Game(seed);
window.__game = game;

// Screenshot mode freezes the simulation on a chosen frame; normal play runs.
const shotMode = driveShot(game, input);
if (shotMode) fitCanvas();

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;
let time = 0;

function frame(now) {
  const elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  time += elapsed;
  if (!game.frozen) {
    acc += elapsed;
    let guard = 0;
    while (acc >= STEP && guard < 5) {
      game.update(STEP, input);
      acc -= STEP;
      guard++;
    }
    if (guard >= 5) acc = 0;
  }
  drawGame(ctx, game, time, input.mouse);
  input.endFrame();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
