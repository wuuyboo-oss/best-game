// Level-up choices for Void Tide. Each upgrade is one clear decision: more
// damage, more shots, more speed, more room for error, or a new trick. The world
// rolls three different ones and the player picks one.
export const UPGRADE_POOL = [
  {
    id: 'damage', name: 'Void Edge', icon: '▲',
    desc: '+25% bullet damage',
    apply: (p) => { p.damage *= 1.25; },
  },
  {
    id: 'fire-rate', name: 'Rapid Coil', icon: '≋',
    desc: '+20% fire rate',
    apply: (p) => { p.fireRate *= 1.2; },
  },
  {
    id: 'multishot', name: 'Split Shot', icon: '✦',
    desc: '+1 projectile per shot',
    max: 3,
    apply: (p) => { p.multishot += 1; },
  },
  {
    id: 'speed', name: 'Swift Current', icon: '»',
    desc: '+12% move speed',
    apply: (p) => { p.speed *= 1.12; },
  },
  {
    id: 'vitality', name: 'Deep Heart', icon: '♥',
    desc: '+25 max HP and heal 25',
    apply: (p) => { p.maxHp += 25; p.heal(25); },
  },
  {
    id: 'magnet', name: 'Tide Pull', icon: '◎',
    desc: '+45% gem magnet radius',
    apply: (p) => { p.magnet *= 1.45; },
  },
  {
    id: 'pierce', name: 'Piercing Light', icon: '→',
    desc: 'Bullets pierce +1 enemy',
    max: 3,
    apply: (p) => { p.pierce += 1; },
  },
  {
    id: 'crit', name: 'Killer Instinct', icon: '✚',
    desc: '+10% critical chance (crits deal double)',
    max: 5,
    apply: (p) => { p.crit += 0.1; },
  },
  {
    id: 'dash', name: 'Phase Step', icon: '↯',
    desc: 'Dash recharges 30% faster',
    max: 3,
    apply: (p) => { p.dashCooldownMax *= 0.7; },
  },
  {
    id: 'nova', name: 'Nova Pulse', icon: '✺',
    desc: 'Every 6s, a ring of 12 shots bursts out',
    max: 1,
    apply: (p) => { p.novaTimer = 6; p.hasNova = true; },
  },
];

// Roll `count` distinct upgrades the player can still take. `taken` counts how
// many times each id was already chosen, so capped upgrades stop appearing.
export function rollUpgrades(rng, count, taken) {
  const available = UPGRADE_POOL.filter((u) => (taken[u.id] || 0) < (u.max ?? 99));
  const pool = [...available];
  const chosen = [];
  while (pool.length > 0 && chosen.length < count) {
    const i = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(i, 1)[0]);
  }
  return chosen;
}
