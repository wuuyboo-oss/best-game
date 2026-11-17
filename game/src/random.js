// Seeded randomness for Void Tide. The game uses one mulberry32 stream so a
// screenshot seed replays the same spawns, drops and upgrade rolls every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Small helpers over a stream, so call sites read like intent, not arithmetic.
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// A uniform angle, for spawn directions and radial bursts.
export function angle(rng) {
  return rng() * Math.PI * 2;
}
