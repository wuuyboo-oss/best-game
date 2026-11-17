// Every moving thing in Void Tide. Entities hold state and one small step of
// motion; the world owns collisions, spawning and the rules between them.
import { CFG, ENEMY_TYPES } from './config.js';
import { range, angle } from './random.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = CFG.playerRadius;
    this.speed = CFG.playerSpeed;
    this.maxHp = CFG.playerMaxHp;
    this.hp = this.maxHp;
    this.fireRate = CFG.playerFireRate;
    this.damage = CFG.playerDamage;
    this.bulletSpeed = CFG.playerBulletSpeed;
    this.multishot = 1;
    this.pierce = 0;
    this.magnet = CFG.playerMagnet;
    this.crit = CFG.playerCrit;
    this.dashCooldownMax = CFG.playerDashCooldown;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.dashDir = { x: 1, y: 0 };
    this.invuln = 0;
    this.fireTimer = 0;
    this.aimX = x + 1;
    this.aimY = y;
    this.novaTimer = 0;
    this.trail = [];
  }

  get alive() { return this.hp > 0; }

  move(dx, dy, dt) {
    if (this.dashTime > 0) {
      this.x += this.dashDir.x * CFG.playerDashSpeed * dt;
      this.y += this.dashDir.y * CFG.playerDashSpeed * dt;
      this.dashTime -= dt;
    } else {
      this.x += dx * this.speed * dt;
      this.y += dy * this.speed * dt;
    }
    this.x = Math.max(this.radius, Math.min(CFG.W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(CFG.H - this.radius, this.y));
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 14) this.trail.shift();
  }

  startDash(dx, dy) {
    if (this.dashCooldown > 0 || this.dashTime > 0) return false;
    const len = Math.hypot(dx, dy);
    this.dashDir = len > 0.01 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 };
    this.dashTime = CFG.playerDashTime;
    this.dashCooldown = this.dashCooldownMax;
    this.invuln = Math.max(this.invuln, CFG.playerDashTime + 0.1);
    return true;
  }

  tick(dt) {
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
  }

  takeDamage(amount) {
    if (this.invuln > 0) return 0;
    this.hp = Math.max(0, this.hp - amount);
    this.invuln = CFG.playerInvulnAfterHit;
    return amount;
  }

  heal(amount) {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }
}

let nextEnemyId = 1;

export class Enemy {
  constructor(type, x, y, wave, rng) {
    const def = ENEMY_TYPES[type];
    const hpScale = 1 + CFG.hpScalePerWave * (wave - 1);
    const speedScale = Math.min(CFG.speedScaleCap, 1 + CFG.speedScalePerWave * (wave - 1));
    const dmgScale = Math.min(CFG.damageScaleCap, 1 + CFG.damageScalePerWave * (wave - 1));
    this.id = nextEnemyId++;
    this.type = type;
    this.def = def;
    this.x = x;
    this.y = y;
    this.radius = def.radius;
    this.hp = def.hp * hpScale;
    this.maxHp = this.hp;
    this.speed = def.speed * speedScale;
    this.damage = Math.round(def.damage * dmgScale);
    this.score = def.score;
    this.xp = def.xp;
    this.color = def.color;
    this.touchTimer = 0; // time until this enemy can hurt the player again
    this.shootTimer = range(rng, 1.2, 2.4);
    this.lungeTimer = range(rng, 1.0, 2.0);
    this.lungeTime = 0;
    this.spawnTimer = 0; // boss: time until it spawns motes
    this.radialTimer = CFG.bossRadialEvery;
    this.wobble = range(rng, 0, Math.PI * 2);
    this.flash = 0;
  }

  get alive() { return this.hp > 0; }

  // Steering: each shape hunts in its own way.
  step(dt, player, rng) {
    if (this.flash > 0) this.flash -= dt;
    if (this.touchTimer > 0) this.touchTimer -= dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;

    if (this.type === 'darter') {
      // Darts close in, then lunges in a straight burst.
      if (this.lungeTime > 0) {
        this.x += this.lungeDir.x * this.speed * 2.1 * dt;
        this.y += this.lungeDir.y * this.speed * 2.1 * dt;
        this.lungeTime -= dt;
      } else {
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
        this.lungeTimer -= dt;
        if (this.lungeTimer <= 0 && dist < 260) {
          this.lungeDir = { x: nx, y: ny };
          this.lungeTime = 0.32;
          this.lungeTimer = range(rng, 1.4, 2.4);
        }
      }
    } else if (this.type === 'spitter') {
      // Keeps its distance and fires from range.
      if (dist > 300) {
        this.x += nx * this.speed * dt;
        this.y += ny * this.speed * dt;
      } else if (dist < 210) {
        this.x -= nx * this.speed * dt;
        this.y -= ny * this.speed * dt;
      } else {
        this.x += -ny * this.speed * 0.4 * dt;
        this.y += nx * this.speed * 0.4 * dt;
      }
      this.shootTimer -= dt;
    } else if (this.type === 'boss') {
      this.x += nx * this.speed * dt;
      this.y += ny * this.speed * dt;
      this.radialTimer -= dt;
      this.spawnTimer -= dt;
    } else {
      // Mote, bulwark and splitter chase, with a wobble so they never stack.
      this.wobble += dt * 2.2;
      const wx = Math.cos(this.wobble) * 0.25;
      const wy = Math.sin(this.wobble) * 0.25;
      this.x += (nx + wx) * this.speed * dt;
      this.y += (ny + wy) * this.speed * dt;
    }

    this.x = Math.max(this.radius, Math.min(CFG.W - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(CFG.H - this.radius, this.y));
  }

  hurt(amount) {
    this.hp -= amount;
    this.flash = 0.08;
    return this.hp <= 0;
  }
}

export class Bullet {
  constructor(x, y, vx, vy, damage, pierce, friendly = true) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.damage = damage;
    this.pierce = pierce;
    this.friendly = friendly;
    this.radius = friendly ? CFG.playerBulletRadius : 7;
    this.life = 1.6;
    this.hitIds = new Set();
  }

  step(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
  }

  get dead() {
    return (
      this.life <= 0 ||
      this.x < -20 || this.x > CFG.W + 20 ||
      this.y < -20 || this.y > CFG.H + 20
    );
  }
}

export class Gem {
  constructor(x, y, value, rng) {
    this.x = x;
    this.y = y;
    this.value = value;
    this.radius = value >= 5 ? 9 : 6;
    this.vx = range(rng, -60, 60);
    this.vy = range(rng, -60, 60);
    this.magnetized = false;
    this.life = 25;
    this.pulse = range(rng, 0, Math.PI * 2);
  }

  step(dt, player) {
    this.pulse += dt * 5;
    this.life -= dt;
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (this.magnetized || dist < player.magnet) {
      this.magnetized = true;
      const pull = CFG.gemMagnetSpeed * (1.6 - Math.min(1, dist / 320));
      this.x += (dx / dist) * pull * dt;
      this.y += (dy / dist) * pull * dt;
    } else {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.94;
      this.vy *= 0.94;
    }
  }
}

export class Pickup {
  constructor(kind, x, y) {
    this.kind = kind; // 'heart' | 'bomb' | 'magnet'
    this.x = x;
    this.y = y;
    this.radius = 13;
    this.life = 12;
    this.pulse = 0;
  }

  step(dt) {
    this.pulse += dt * 4;
    this.life -= dt;
  }
}

export class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
  }

  step(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.life -= dt;
  }

  get dead() { return this.life <= 0; }
}

export class Floater {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0.9;
    this.maxLife = 0.9;
  }

  step(dt) {
    this.y -= 42 * dt;
    this.life -= dt;
  }

  get dead() { return this.life <= 0; }
}

// Burst of sparks, in the colour of whatever just broke.
export function burst(particles, x, y, color, count, rng, speed = 260) {
  for (let i = 0; i < count; i++) {
    const a = angle(rng);
    const s = range(rng, speed * 0.3, speed);
    particles.push(new Particle(
      x, y,
      Math.cos(a) * s, Math.sin(a) * s,
      color, range(rng, 2, 4.5), range(rng, 0.3, 0.7),
    ));
  }
}
