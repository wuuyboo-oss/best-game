// Synthesized sound for Void Tide: every effect is a small WebAudio recipe, so
// the game ships no audio files and never touches the network. The context is
// created lazily on the first user gesture (browsers block audio before that),
// and every call is a no-op until then.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  // Call from a click or key press. Safe to call repeatedly.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.ctx.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.32;
    return this.muted;
  }

  // One short oscillator blip: frequency slides from `from` to `to`.
  blip({ from = 440, to = 220, dur = 0.08, type = 'square', vol = 0.5 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A burst of filtered noise, for hits and explosions.
  noise({ dur = 0.15, vol = 0.4, freq = 1200 }) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t);
  }

  // A little arpeggio, for level-ups and victories.
  arpeggio(notes, step = 0.09, type = 'sine', vol = 0.4) {
    if (!this.ctx || this.muted) return;
    notes.forEach((freq, i) => {
      const t = this.ctx.currentTime + i * step;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.24);
    });
  }

  // Named game events, so the world calls what happened, not how it sounds.
  shoot() { this.blip({ from: 720 + Math.random() * 120, to: 240, dur: 0.06, type: 'square', vol: 0.16 }); }
  hit() { this.noise({ dur: 0.05, vol: 0.18, freq: 2400 }); }
  enemyDie() { this.blip({ from: 320, to: 60, dur: 0.16, type: 'sawtooth', vol: 0.3 }); this.noise({ dur: 0.1, vol: 0.2, freq: 900 }); }
  gem(combo = 0) { this.blip({ from: 660 + Math.min(combo, 12) * 30, to: 990 + Math.min(combo, 12) * 30, dur: 0.07, type: 'sine', vol: 0.22 }); }
  hurt() { this.blip({ from: 160, to: 50, dur: 0.22, type: 'sawtooth', vol: 0.5 }); this.noise({ dur: 0.18, vol: 0.3, freq: 500 }); }
  levelUp() { this.arpeggio([523, 659, 784, 1047], 0.08, 'triangle', 0.35); }
  pickup() { this.arpeggio([880, 1175], 0.07, 'sine', 0.3); }
  dash() { this.noise({ dur: 0.16, vol: 0.22, freq: 3200 }); }
  bossSpawn() { this.blip({ from: 90, to: 45, dur: 0.7, type: 'sawtooth', vol: 0.5 }); }
  waveClear() { this.arpeggio([784, 988, 1175], 0.09, 'triangle', 0.3); }
  victory() { this.arpeggio([523, 659, 784, 1047, 1319], 0.11, 'triangle', 0.35); }
  gameOver() { this.arpeggio([392, 330, 262, 196], 0.16, 'sawtooth', 0.3); }
  click() { this.blip({ from: 900, to: 700, dur: 0.05, type: 'sine', vol: 0.25 }); }
}
