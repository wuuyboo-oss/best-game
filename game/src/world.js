// The game itself: state machine, waves, combat, scoring and the level-up
// flow. Rendering lives in render.js; this file only decides what happens.
import { CFG, ENEMY_TYPES } from './config.js';
import { mulberry32, range, pick, chance, angle } from './random.js';
import { Player, Enemy, Bullet, Gem, Pickup, Particle, Floater, burst } from './entities.js';
import { rollUpgrades } from './upgrades.js';
import { SoundBank } from './audio.js';

export class Game {
  constructor(seed) {
    this.rng = mulberry32(seed >>> 0);
    this.sfx = new SoundBank();
    this.state = 'title'; // title | playing | levelup | paused | gameover | victory
    this.best = this._loadBest();
    // Shot/test controls live outside reset(): a restart must not switch them off.
    this.autopilot = false;
    this.frozen = false;
    this.shotMode = null;
    this.reset();
  }

  _loadBest() {
    try {
      return Number(window.localStorage.getItem('voidtide.best') || 0) || 0;
    } catch {
      return 0;
    }
  }

  _saveBest() {
    try {
      window.localStorage.setItem('voidtide.best', String(this.best));
    } catch {
      // Storage may be unavailable; the game plays on without it.
    }
  }

  reset() {
    this.player = new Player(CFG.W / 2, CFG.H / 2);
    this.enemies = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.gems = [];
    this.pickups = [];
    this.particles = [];
    this.floaters = [];
    this.wave = 0;
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = CFG.xpToNextBase;
    this.takenUpgrades = {};
    this.upgradeChoices = [];
    this.levelsPending = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.breather = 0;
    this.timePlayed = 0;
    this.shake = 0;
    this.flashRed = 0;
    this.boss = null;
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.beginWave(1);
  }

  // --- Waves -------------------------------------------------------------

  beginWave(n) {
    this.wave = n;
    const isBoss = n % CFG.bossEvery === 0;
    let budget = CFG.waveBudgetBase + (n - 1) * CFG.waveBudgetPerWave;
    const queue = [];
    const available = ['mote'];
    if (n >= 2) available.push('darter');
    if (n >= 3) available.push('splitter', 'bulwark');
    if (n >= 4) available.push('spitter');
    while (budget > 0) {
      const type = pick(this.rng, available);
      const cost = ENEMY_TYPES[type].cost;
      if (cost > budget && queue.length > 0) break;
      queue.push(type);
      budget -= cost;
    }
    // Shuffle so the wave never arrives in clumps of one kind.
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }
    if (isBoss) {
      queue.unshift('boss');
      // A boss never fights alone: a few motes ride in with it.
      for (let i = 0; i < 3 + n / 5; i++) queue.push('mote');
      this.sfx.bossSpawn();
    }
    this.spawnQueue = queue;
    this.spawnTimer = 0.5;
  }

  edgePoint() {
    const side = Math.floor(this.rng() * 4);
    const m = 30;
    if (side === 0) return { x: range(this.rng, m, CFG.W - m), y: m };
    if (side === 1) return { x: range(this.rng, m, CFG.W - m), y: CFG.H - m };
    if (side === 2) return { x: m, y: range(this.rng, m, CFG.H - m) };
    return { x: CFG.W - m, y: range(this.rng, m, CFG.H - m) };
  }

  spawnNext() {
    const type = this.spawnQueue.shift();
    const p = this.edgePoint();
    const enemy = new Enemy(type, p.x, p.y, this.wave, this.rng);
    this.enemies.push(enemy);
    if (type === 'boss') this.boss = enemy;
  }

  // --- Combat ------------------------------------------------------------

  fire() {
    const p = this.player;
    const base = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    const spread = 0.14;
    const n = p.multishot;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * spread;
      const a = base + off;
      const isCrit = this.rng() < p.crit;
      this.bullets.push(new Bullet(
        p.x + Math.cos(a) * (p.radius + 6),
        p.y + Math.sin(a) * (p.radius + 6),
        Math.cos(a) * p.bulletSpeed,
        Math.sin(a) * p.bulletSpeed,
        p.damage * (isCrit ? 2 : 1),
        p.pierce,
        true,
      ));
      this.bullets[this.bullets.length - 1].crit = isCrit;
    }
    this.sfx.shoot();
  }

  novaBurst() {
    const p = this.player;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      this.bullets.push(new Bullet(
        p.x, p.y,
        Math.cos(a) * p.bulletSpeed * 0.85,
        Math.sin(a) * p.bulletSpeed * 0.85,
        p.damage, 0, true,
      ));
    }
    burst(this.particles, p.x, p.y, '#7df9ff', 18, this.rng, 300);
    this.sfx.pickup();
  }

  damageEnemy(enemy, amount, isCrit) {
    const died = enemy.hurt(amount);
    burst(this.particles, enemy.x, enemy.y, enemy.color, isCrit ? 8 : 3, this.rng, 200);
    if (isCrit) {
      this.floaters.push(new Floater(enemy.x, enemy.y - enemy.radius - 6, `${Math.round(amount)}!`, '#ffd94d'));
    }
    if (died) this.killEnemy(enemy);
    else this.sfx.hit();
  }

  killEnemy(enemy) {
    this.kills++;
    this.combo++;
    this.comboTimer = CFG.comboWindow;
    const mult = Math.min(CFG.comboCap, 1 + (this.combo - 1) * CFG.comboStep);
    this.addScore(enemy.score, mult);
    burst(this.particles, enemy.x, enemy.y, enemy.color, enemy.type === 'boss' ? 60 : 14, this.rng, 300);
    this.sfx.enemyDie();
    if (enemy.type === 'boss') {
      this.boss = null;
      this.shake = Math.max(this.shake, 12);
    } else {
      this.shake = Math.max(this.shake, CFG.shakeOnDeath);
    }

    // Splitters break apart instead of dying quietly.
    if (enemy.type === 'splitter') {
      for (let i = 0; i < 3; i++) {
        const a = angle(this.rng);
        const child = new Enemy('mote', enemy.x + Math.cos(a) * 20, enemy.y + Math.sin(a) * 20, this.wave, this.rng);
        this.enemies.push(child);
      }
    }

    // Experience gems: big values split into several gems.
    let remaining = enemy.xp;
    while (remaining >= 5) {
      this.gems.push(new Gem(enemy.x, enemy.y, 5, this.rng));
      remaining -= 5;
    }
    for (let i = 0; i < remaining; i++) this.gems.push(new Gem(enemy.x, enemy.y, 1, this.rng));

    // Pickups are rare on purpose: a run should feel lucky to see one.
    const roll = this.rng();
    if (roll < CFG.heartDropChance) this.pickups.push(new Pickup('heart', enemy.x, enemy.y));
    else if (roll < CFG.heartDropChance + CFG.bombDropChance) this.pickups.push(new Pickup('bomb', enemy.x, enemy.y));
    else if (roll < CFG.heartDropChance + CFG.bombDropChance + CFG.magnetDropChance) this.pickups.push(new Pickup('magnet', enemy.x, enemy.y));

    this.enemies = this.enemies.filter((e) => e !== enemy);
  }

  addScore(base, mult = 1) {
    this.score += Math.round(base * mult);
  }

  gainXp(value) {
    this.xp += value;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = CFG.xpToNextBase + (this.level - 1) * CFG.xpToNextPerLevel;
      this.levelsPending++;
    }
    // Queue the choices: a big haul can earn two levels at once, and each
    // one gets its own pick instead of the second overwriting the first.
    if (this.levelsPending > 0 && this.state === 'playing') this.openLevelUp();
  }

  openLevelUp() {
    this.upgradeChoices = rollUpgrades(this.rng, 3, this.takenUpgrades);
    if (this.upgradeChoices.length === 0) return;
    this.state = 'levelup';
    this.sfx.levelUp();
  }

  chooseUpgrade(index) {
    const choice = this.upgradeChoices[index];
    if (!choice) return;
    choice.apply(this.player);
    this.takenUpgrades[choice.id] = (this.takenUpgrades[choice.id] || 0) + 1;
    this.upgradeChoices = [];
    this.levelsPending--;
    if (this.levelsPending > 0) this.openLevelUp();
    else this.state = 'playing';
    this.sfx.click();
  }

  hurtPlayer(amount) {
    const dealt = this.player.takeDamage(amount);
    if (dealt > 0) {
      this.shake = Math.max(this.shake, CFG.shakeOnHit);
      this.flashRed = 0.35;
      this.combo = 0;
      this.sfx.hurt();
      if (!this.player.alive) this.endGame(false);
    }
  }

  endGame(won) {
    this.state = won ? 'victory' : 'gameover';
    if (this.score > this.best) {
      this.best = this.score;
      this._saveBest();
    }
    if (won) this.sfx.victory();
    else this.sfx.gameOver();
  }

  usePickup(pickup) {
    if (pickup.kind === 'heart') {
      this.player.heal(CFG.heartHeal);
      this.floaters.push(new Floater(this.player.x, this.player.y - 24, `+${CFG.heartHeal} HP`, '#59e391'));
    } else if (pickup.kind === 'bomb') {
      for (const e of [...this.enemies]) {
        if (e.type === 'boss') this.damageEnemy(e, CFG.bombDamage, false);
        else this.killEnemy(e);
      }
      this.shake = 14;
    } else if (pickup.kind === 'magnet') {
      for (const g of this.gems) g.magnetized = true;
    }
    this.sfx.pickup();
  }

  // --- Autopilot (screenshots and tests only) ---------------------------

  autopilotStep(dt) {
    const p = this.player;
    // Orbit the centre, keep a little distance from the nearest enemy.
    let mx = 0;
    let my = 0;
    const cx = CFG.W / 2;
    const cy = CFG.H / 2;
    const toCentre = Math.atan2(cy - p.y, cx - p.x);
    mx += Math.cos(toCentre + Math.PI / 2) * 0.7;
    my += Math.sin(toCentre + Math.PI / 2) * 0.7;
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }
    if (nearest) {
      p.aimX = nearest.x;
      p.aimY = nearest.y;
      if (nearestDist < 130) {
        mx += (p.x - nearest.x) / nearestDist;
        my += (p.y - nearest.y) / nearestDist;
      }
      if (nearestDist < 200 && p.dashCooldown <= 0) p.startDash(mx, my);
    }
    const len = Math.hypot(mx, my) || 1;
    return { x: mx / len, y: my / len };
  }

  // --- Main update ---------------------------------------------------------

  update(dt, input) {
    if (this.frozen) return;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
    if (this.flashRed > 0) this.flashRed -= dt;

    if (input.wasPressed('m')) this.sfx.toggleMute();

    if (this.state === 'title') {
      if (input.wasPressed('Enter') || input.takeClicks().length > 0) {
        this.sfx.unlock();
        this.sfx.click();
        this.start();
      }
      return;
    }

    if (this.state === 'gameover' || this.state === 'victory') {
      if (input.wasPressed('r') || input.wasPressed('Enter') || input.takeClicks().length > 0) {
        this.sfx.unlock();
        this.start();
      }
      return;
    }

    if (this.state === 'paused') {
      if (input.wasPressed('p') || input.wasPressed('Escape') || input.takeClicks().length > 0) {
        this.state = 'playing';
        this.sfx.click();
      }
      return;
    }

    if (this.state === 'levelup') {
      if (input.wasPressed('1')) this.chooseUpgrade(0);
      else if (input.wasPressed('2')) this.chooseUpgrade(1);
      else if (input.wasPressed('3')) this.chooseUpgrade(2);
      else {
        const clicks = input.takeClicks();
        for (const c of clicks) {
          const idx = this.cardAt(c.x, c.y);
          if (idx >= 0) { this.chooseUpgrade(idx); break; }
        }
      }
      if (this.autopilot && this.state === 'levelup') this.chooseUpgrade(0);
      return;
    }

    // state === 'playing'
    if (input.wasPressed('p') || input.wasPressed('Escape')) {
      this.state = 'paused';
      return;
    }

    const p = this.player;
    this.timePlayed += dt;
    p.tick(dt);

    let move;
    if (this.autopilot) {
      move = this.autopilotStep(dt);
    } else {
      move = input.moveVector();
      p.aimX = input.mouse.x;
      p.aimY = input.mouse.y;
      if (input.wasPressed(' ')) {
        if (p.startDash(move.x, move.y)) this.sfx.dash();
      }
    }
    p.move(move.x, move.y, dt);

    // Auto-fire at the aim point (tick() already counted the timer down).
    if (p.fireTimer <= 0) {
      this.fire();
      p.fireTimer = 1 / p.fireRate;
    }

    // Nova ring.
    if (p.hasNova) {
      p.novaTimer -= dt;
      if (p.novaTimer <= 0) {
        this.novaBurst();
        p.novaTimer = 6;
      }
    }

    // Spawn trickle.
    if (this.spawnQueue.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnNext();
        this.spawnTimer = Math.max(0.25, 0.95 - this.wave * 0.07);
      }
    }

    // Enemies move; spitters and the boss also shoot.
    for (const e of [...this.enemies]) {
      e.step(dt, p, this.rng);
      if (e.type === 'spitter' && e.shootTimer <= 0 && e.alive) {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        this.enemyBullets.push(new Bullet(e.x, e.y, Math.cos(a) * 165, Math.sin(a) * 165, e.damage, 0, false));
        e.shootTimer = 2.2;
      }
      if (e.type === 'boss' && e.alive) {
        if (e.radialTimer <= 0) {
          for (let i = 0; i < CFG.bossRadialCount; i++) {
            const a = (i / CFG.bossRadialCount) * Math.PI * 2 + this.timePlayed;
            this.enemyBullets.push(new Bullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150, 10, 0, false));
          }
          e.radialTimer = CFG.bossRadialEvery;
          this.sfx.bossSpawn();
        }
        if (e.spawnTimer <= 0) {
          for (let i = 0; i < 2; i++) {
            const a = angle(this.rng);
            this.enemies.push(new Enemy('mote', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60, this.wave, this.rng));
          }
          e.spawnTimer = CFG.bossSpawnEvery;
        }
      }
    }

    // Friendly bullets vs enemies.
    for (const b of [...this.bullets]) {
      b.step(dt);
      if (b.dead) continue;
      for (const e of [...this.enemies]) {
        if (!e.alive || b.hitIds.has(e.id)) continue;
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.radius + b.radius) * (e.radius + b.radius)) {
          b.hitIds.add(e.id);
          this.damageEnemy(e, b.damage, !!b.crit);
          if (b.pierce > 0) b.pierce--;
          else { b.life = 0; break; }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => !b.dead);

    // Enemy bullets vs the player.
    for (const b of [...this.enemyBullets]) {
      b.step(dt);
      if (b.dead) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      if (dx * dx + dy * dy < (p.radius + b.radius) * (p.radius + b.radius)) {
        this.hurtPlayer(b.damage);
        b.life = 0;
      }
    }
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);

    // Touch damage.
    for (const e of this.enemies) {
      if (e.touchTimer > 0 || !p.alive) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      if (dx * dx + dy * dy < (p.radius + e.radius) * (p.radius + e.radius)) {
        e.touchTimer = 0.7;
        this.hurtPlayer(e.damage);
        // Shove the enemy back so it cannot stick to the player.
        const d = Math.hypot(dx, dy) || 1;
        e.x -= (dx / d) * 26;
        e.y -= (dy / d) * 26;
      }
    }

    // Gems and pickups.
    for (const g of [...this.gems]) {
      g.step(dt, p);
      const dx = p.x - g.x;
      const dy = p.y - g.y;
      if (dx * dx + dy * dy < (p.radius + g.radius + 4) * (p.radius + g.radius + 4)) {
        this.gainXp(g.value);
        this.sfx.gem(this.combo);
        this.gems = this.gems.filter((x) => x !== g);
      }
    }
    this.gems = this.gems.filter((g) => g.life > 0);
    for (const pk of [...this.pickups]) {
      pk.step(dt);
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      if (dx * dx + dy * dy < (p.radius + pk.radius + 4) * (p.radius + pk.radius + 4)) {
        this.usePickup(pk);
        this.pickups = this.pickups.filter((x) => x !== pk);
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);

    // Combo decay.
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Particles and floating text.
    for (const pt of this.particles) pt.step(dt);
    this.particles = this.particles.filter((pt) => !pt.dead);
    for (const f of this.floaters) f.step(dt);
    this.floaters = this.floaters.filter((f) => !f.dead);

    // Wave clear: queue empty, no enemies left.
    if (this.state === 'playing' && this.spawnQueue.length === 0 && this.enemies.length === 0) {
      if (this.wave >= CFG.winWave) {
        this.endGame(true);
        return;
      }
      this.addScore(CFG.waveClearBonus + this.wave * 10);
      this.floaters.push(new Floater(CFG.W / 2, CFG.H / 2 - 40, `WAVE ${this.wave} CLEAR  +${CFG.waveClearBonus + this.wave * 10}`, '#7df9ff'));
      this.sfx.waveClear();
      this.breather = CFG.breatherSeconds;
      this.beginWave(this.wave + 1);
      // Hold the next wave's first spawns back for the breather.
      this.spawnTimer = CFG.breatherSeconds;
    }
  }

  // Which upgrade card (0-2), if any, sits under an arena point.
  cardAt(x, y) {
    const cardW = 300;
    const cardH = 210;
    const gap = 28;
    const total = cardW * 3 + gap * 2;
    const x0 = (CFG.W - total) / 2;
    const y0 = 260;
    for (let i = 0; i < 3; i++) {
      const cx = x0 + i * (cardW + gap);
      if (x >= cx && x <= cx + cardW && y >= y0 && y <= y0 + cardH) return i;
    }
    return -1;
  }

  // Small read-only snapshot for tests and the screenshot driver.
  debug() {
    return {
      state: this.state,
      score: this.score,
      wave: this.wave,
      hp: Math.round(this.player.hp),
      level: this.level,
      kills: this.kills,
      enemies: this.enemies.length,
      bullets: this.bullets.length,
      gems: this.gems.length,
      timePlayed: Math.round(this.timePlayed * 10) / 10,
    };
  }
}
