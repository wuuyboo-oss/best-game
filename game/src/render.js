// Everything Void Tide shows: the abyss, the entities, the HUD and every
// screen. Drawing reads the game and never changes it.
import { CFG } from './config.js';

let starfield = null;
let nebula = null;

function buildBackdrop() {
  starfield = [];
  for (let i = 0; i < 150; i++) {
    starfield.push({
      x: Math.random() * CFG.W,
      y: Math.random() * CFG.H,
      r: Math.random() * 1.6 + 0.4,
      tw: Math.random() * Math.PI * 2,
    });
  }
  nebula = document.createElement('canvas');
  nebula.width = CFG.W;
  nebula.height = CFG.H;
  const nctx = nebula.getContext('2d');
  const blobs = [
    { x: 220, y: 150, r: 260, c: 'rgba(64, 32, 140, 0.20)' },
    { x: 1060, y: 560, r: 300, c: 'rgba(10, 90, 110, 0.20)' },
    { x: 640, y: 360, r: 380, c: 'rgba(140, 24, 90, 0.10)' },
    { x: 980, y: 120, r: 200, c: 'rgba(20, 60, 160, 0.14)' },
  ];
  for (const b of blobs) {
    const g = nctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, b.c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    nctx.fillStyle = g;
    nctx.fillRect(b.x - b.r, b.y - b.r, b.r * 2, b.r * 2);
  }
}

function glow(ctx, color, blur) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function drawBackground(ctx, time) {
  if (!starfield) buildBackdrop();
  const g = ctx.createLinearGradient(0, 0, 0, CFG.H);
  g.addColorStop(0, '#070818');
  g.addColorStop(0.55, '#0a0d2a');
  g.addColorStop(1, '#12082e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.drawImage(nebula, 0, 0);
  ctx.save();
  for (const s of starfield) {
    const a = 0.35 + 0.35 * Math.sin(time * 1.4 + s.tw);
    ctx.globalAlpha = a;
    ctx.fillStyle = '#cfe6ff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Soft arena border.
  ctx.save();
  ctx.strokeStyle = 'rgba(125, 249, 255, 0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, CFG.W - 20, CFG.H - 20);
  ctx.restore();
}

function drawPlayer(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Dash trail.
  for (let i = 0; i < p.trail.length; i++) {
    const t = p.trail[i];
    const a = (i / p.trail.length) * 0.25;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#37d3e6';
    ctx.beginPath();
    ctx.arc(t.x - p.x, t.y - p.y, p.radius * (0.4 + 0.6 * (i / p.trail.length)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  const blink = p.invuln > 0 && Math.floor(time * 18) % 2 === 0;
  if (!blink) {
    glow(ctx, '#37d3e6', 22);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, p.radius + 6);
    g.addColorStop(0, '#eaffff');
    g.addColorStop(0.5, '#37d3e6');
    g.addColorStop(1, '#0a6d8f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#eaffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius + 3, 0, Math.PI * 2);
    ctx.stroke();
    // Aim tick.
    const a = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    ctx.strokeStyle = '#eaffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (p.radius + 5), Math.sin(a) * (p.radius + 5));
    ctx.lineTo(Math.cos(a) * (p.radius + 13), Math.sin(a) * (p.radius + 13));
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemy(ctx, e, time) {
  ctx.save();
  ctx.translate(e.x, e.y);
  if (e.flash > 0) {
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
  } else {
    glow(ctx, e.color, 14);
    ctx.fillStyle = e.color;
  }
  const r = e.radius;
  ctx.beginPath();
  if (e.def.shape === 'spike') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + time * 0.8;
      const rr = i % 2 === 0 ? r + 4 : r - 2;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else if (e.def.shape === 'dart') {
    const a = Math.atan2(e.vy || 0, e.vx || 1);
    ctx.rotate(0); // darters point along travel via wobble instead
    ctx.moveTo(r + 4, 0);
    ctx.lineTo(-r, r * 0.8);
    ctx.lineTo(-r * 0.5, 0);
    ctx.lineTo(-r, -r * 0.8);
    ctx.closePath();
  } else if (e.def.shape === 'hex') {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
  } else if (e.def.shape === 'blob') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.arc(r * 0.55, -r * 0.4, r * 0.55, 0, Math.PI * 2);
  } else if (e.def.shape === 'diamond') {
    ctx.moveTo(0, -r - 3);
    ctx.lineTo(r, 0);
    ctx.lineTo(0, r + 3);
    ctx.lineTo(-r, 0);
    ctx.closePath();
  } else if (e.def.shape === 'star') {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + time * 0.4;
      const rr = i % 2 === 0 ? r + 8 : r - 6;
      ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.shadowBlur = 0;
  // Wounded enemies show a thin health arc.
  if (e.hp < e.maxHp && e.type !== 'boss') {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e.hp) / e.maxHp);
    ctx.stroke();
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, fill, back = 'rgba(255,255,255,0.12)') {
  ctx.save();
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

function drawHud(ctx, game) {
  const p = game.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  // XP bar across the top.
  bar(ctx, 20, 14, CFG.W - 40, 8, game.xp / game.xpToNext, '#37d3e6');
  ctx.fillStyle = '#dffaff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`LEVEL ${game.level}`, 20, 40);
  ctx.textAlign = 'center';
  ctx.fillText(`WAVE ${game.wave} / 10`, CFG.W / 2, 40);
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${game.score}`, CFG.W - 20, 40);
  // HP bar, bottom left.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#dffaff';
  ctx.fillText('HP', 20, CFG.H - 38);
  bar(ctx, 52, CFG.H - 50, 220, 14, p.hp / p.maxHp, p.hp / p.maxHp > 0.3 ? '#59e391' : '#ff3d5e');
  ctx.fillStyle = '#dffaff';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 280, CFG.H - 38);
  // Combo, bottom right.
  if (game.combo > 1) {
    const mult = Math.min(3.4, 1 + (game.combo - 1) * 0.1);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`COMBO x${game.combo}  ·  x${mult.toFixed(1)}`, CFG.W - 20, CFG.H - 34);
  }
  // Dash cooldown, bottom centre.
  const dashFrac = 1 - Math.max(0, p.dashCooldown) / p.dashCooldownMax;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#9fb4d8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(dashFrac >= 1 ? 'DASH READY  [SPACE]' : 'DASH…', CFG.W / 2, CFG.H - 38);
  bar(ctx, CFG.W / 2 - 50, CFG.H - 32, 100, 6, dashFrac, '#7df9ff');
  // Boss bar.
  if (game.boss) {
    const b = game.boss;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffb3c0';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('TIDE LEVIATHAN', CFG.W / 2, 64);
    bar(ctx, CFG.W / 2 - 220, 72, 440, 10, b.hp / b.maxHp, '#ff3d5e');
  }
  ctx.restore();
}

function drawCards(ctx, game) {
  const cardW = 300;
  const cardH = 210;
  const gap = 28;
  const total = cardW * 3 + gap * 2;
  const x0 = (CFG.W - total) / 2;
  const y0 = 260;
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 18, 0.72)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaffff';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(`LEVEL ${game.level} — CHOOSE AN UPGRADE`, CFG.W / 2, 200);
  ctx.fillStyle = '#9fb4d8';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Click a card, or press 1 / 2 / 3', CFG.W / 2, 228);
  game.upgradeChoices.forEach((u, i) => {
    const x = x0 + i * (cardW + gap);
    const hover = game._hoverCard === i;
    ctx.fillStyle = hover ? 'rgba(55, 211, 230, 0.22)' : 'rgba(20, 28, 64, 0.9)';
    ctx.strokeStyle = hover ? '#7df9ff' : 'rgba(125, 249, 255, 0.4)';
    ctx.lineWidth = hover ? 3 : 2;
    ctx.beginPath();
    ctx.roundRect(x, y0, cardW, cardH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7df9ff';
    ctx.font = '44px system-ui, sans-serif';
    ctx.fillText(u.icon, x + cardW / 2, y0 + 66);
    ctx.fillStyle = '#eaffff';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(u.name, x + cardW / 2, y0 + 108);
    ctx.fillStyle = '#b9c8e8';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(u.desc, x + cardW / 2, y0 + 140);
    ctx.fillStyle = '#7d8db0';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]`, x + cardW / 2, y0 + 182);
  });
  ctx.restore();
}

function drawCenteredPanel(ctx, title, titleColor, lines, hint) {
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 18, 0.78)';
  ctx.fillRect(0, 0, CFG.W, CFG.H);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(title, CFG.W / 2, 250);
  ctx.fillStyle = '#dffaff';
  ctx.font = '19px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, CFG.W / 2, 310 + i * 34));
  ctx.fillStyle = '#7df9ff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(hint, CFG.W / 2, 310 + lines.length * 34 + 28);
  ctx.restore();
}

function drawTitle(ctx, game) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eaffff';
  ctx.font = 'bold 84px system-ui, sans-serif';
  glow(ctx, '#37d3e6', 30);
  ctx.fillText('VOID TIDE', CFG.W / 2, 250);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9fd8ff';
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('A neon arena survivor — hold the line against the tide', CFG.W / 2, 296);
  ctx.fillStyle = '#dffaff';
  ctx.font = '17px system-ui, sans-serif';
  const lines = [
    'WASD / Arrows — move      Mouse — aim (auto-fire)',
    'SPACE — dash through danger      P — pause      M — mute',
    'Collect shards, level up, pick your upgrades, break Wave 10.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, CFG.W / 2, 350 + i * 30));
  if (game.best > 0) {
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${game.best}`, CFG.W / 2, 460);
  }
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 350);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#7df9ff';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO START', CFG.W / 2, 530);
  ctx.restore();
}

// The one draw call the main loop makes. `time` is seconds since boot.
export function drawGame(ctx, game, time, mouse) {
  ctx.save();
  // Screen shake.
  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }
  drawBackground(ctx, time);
  const p = game.player;

  // Gems.
  for (const g of game.gems) {
    const s = g.radius * (1 + 0.18 * Math.sin(g.pulse));
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.rotate(Math.PI / 4);
    glow(ctx, '#37d3e6', 10);
    ctx.fillStyle = g.value >= 5 ? '#ffd94d' : '#7df9ff';
    ctx.fillRect(-s / 1.4, -s / 1.4, s * 1.4, s * 1.4);
    ctx.restore();
  }

  // Pickups.
  for (const pk of game.pickups) {
    ctx.save();
    ctx.translate(pk.x, pk.y);
    const bob = Math.sin(pk.pulse) * 3;
    ctx.translate(0, bob);
    glow(ctx, pk.kind === 'heart' ? '#59e391' : pk.kind === 'bomb' ? '#ff9a3d' : '#c77dff', 16);
    ctx.fillStyle = pk.kind === 'heart' ? '#59e391' : pk.kind === 'bomb' ? '#ff9a3d' : '#c77dff';
    ctx.beginPath();
    ctx.arc(0, 0, pk.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#06101e';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'heart' ? '+' : pk.kind === 'bomb' ? '✹' : '◎', 0, 1);
    ctx.restore();
  }

  // Enemies, then bullets, then the player on top.
  for (const e of game.enemies) drawEnemy(ctx, e, time);
  for (const b of game.enemyBullets) {
    ctx.save();
    glow(ctx, '#ff3d5e', 12);
    ctx.fillStyle = '#ff5e7a';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const b of game.bullets) {
    ctx.save();
    glow(ctx, '#7df9ff', 10);
    ctx.fillStyle = b.crit ? '#ffd94d' : '#aef6ff';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (game.state !== 'title') drawPlayer(ctx, p, time);

  // Particles and floating text.
  for (const pt of game.particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const f of game.floaters) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
    ctx.fillStyle = f.color;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }

  ctx.restore();

  // HUD and screens sit above the shake.
  if (game.state === 'playing' || game.state === 'paused' || game.state === 'levelup') {
    drawHud(ctx, game);
  }
  if (game.state === 'title') drawTitle(ctx, game);
  if (game.state === 'levelup') {
    game._hoverCard = mouse ? game.cardAt(mouse.x, mouse.y) : -1;
    drawCards(ctx, game);
  }
  if (game.state === 'paused') {
    drawCenteredPanel(ctx, 'PAUSED', '#eaffff', ['Take a breath. The tide waits.'], 'P / CLICK TO RESUME');
  }
  if (game.state === 'gameover') {
    drawCenteredPanel(ctx, 'THE TIDE TOOK YOU', '#ff5e7a', [
      `You fell on Wave ${game.wave}  ·  Score ${game.score}  ·  ${game.kills} kills`,
      `Level ${game.level}  ·  Survived ${Math.round(game.timePlayed)}s  ·  Best ${game.best}`,
    ], 'PRESS R OR CLICK TO TRY AGAIN');
  }
  if (game.state === 'victory') {
    drawCenteredPanel(ctx, 'TIDE BROKEN', '#ffd94d', [
      `Wave 10 falls. Score ${game.score}  ·  ${game.kills} kills  ·  Level ${game.level}`,
      `Survived ${Math.round(game.timePlayed)}s  ·  Best ${game.best}`,
    ], 'PRESS R OR CLICK TO PLAY AGAIN');
  }

  // Red flash on damage.
  if (game.flashRed > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(0.28, game.flashRed);
    ctx.fillStyle = '#ff2244';
    ctx.fillRect(0, 0, CFG.W, CFG.H);
    ctx.restore();
  }
}
