// Void Tide — tuning constants. One place for every number the game balances on,
// so a tweak here retunes the whole game without touching the systems.
export const CFG = {
  // Arena (internal resolution; the canvas scales to fit the window).
  W: 1280,
  H: 720,

  // Player.
  playerRadius: 14,
  playerSpeed: 265,
  playerMaxHp: 100,
  playerFireRate: 3.0, // shots per second
  playerDamage: 12,
  playerBulletSpeed: 540,
  playerBulletRadius: 5,
  playerMagnet: 95,
  playerCrit: 0.05,
  playerDashCooldown: 2.6,
  playerDashTime: 0.16,
  playerDashSpeed: 900,
  playerInvulnAfterHit: 0.45,

  // Waves.
  waveBudgetBase: 6, // points of enemies in wave 1
  waveBudgetPerWave: 4,
  waveClearBonus: 50,
  breatherSeconds: 3,
  bossEvery: 5,
  winWave: 10,

  // Enemy scaling per wave (multiplicative on hp, additive on speed/damage, capped).
  hpScalePerWave: 0.18,
  speedScalePerWave: 0.02,
  speedScaleCap: 1.35,
  damageScalePerWave: 0.05,
  damageScaleCap: 1.6,

  // Experience and levels.
  xpToNextBase: 8,
  xpToNextPerLevel: 6,
  gemMagnetSpeed: 620,

  // Combo: kills within this window chain; each chained kill raises the multiplier.
  comboWindow: 2.5,
  comboStep: 0.1,
  comboCap: 3.4,

  // Drops (roll per enemy death).
  heartDropChance: 0.03,
  bombDropChance: 0.015,
  magnetDropChance: 0.02,
  heartHeal: 22,
  bombDamage: 160,

  // Boss.
  bossBaseHp: 950,
  bossRadialCount: 10,
  bossRadialEvery: 3.0,
  bossSpawnEvery: 6.0,

  // Feel.
  shakeOnHit: 7,
  shakeOnDeath: 3,
};

// Enemy archetypes. Cost is the wave-budget price; the rest shapes how each one
// moves, fights and pays out. Colours double as the visual language of the game.
export const ENEMY_TYPES = {
  mote: {
    name: 'Mote', cost: 1, hp: 18, speed: 96, radius: 12, damage: 8,
    score: 10, xp: 1, color: '#ff4fd8', shape: 'spike',
  },
  darter: {
    name: 'Darter', cost: 2, hp: 12, speed: 172, radius: 10, damage: 6,
    score: 15, xp: 1, color: '#ff9a3d', shape: 'dart',
  },
  bulwark: {
    name: 'Bulwark', cost: 4, hp: 92, speed: 46, radius: 22, damage: 16,
    score: 30, xp: 3, color: '#a06bff', shape: 'hex',
  },
  splitter: {
    name: 'Splitter', cost: 3, hp: 30, speed: 72, radius: 16, damage: 10,
    score: 20, xp: 2, color: '#59e391', shape: 'blob',
  },
  spitter: {
    name: 'Spitter', cost: 3, hp: 24, speed: 62, radius: 14, damage: 8,
    score: 25, xp: 2, color: '#37d3e6', shape: 'diamond',
  },
  boss: {
    name: 'Tide Leviathan', cost: 0, hp: CFG.bossBaseHp, speed: 42, radius: 46,
    damage: 24, score: 500, xp: 20, color: '#ff3d5e', shape: 'star',
  },
};
