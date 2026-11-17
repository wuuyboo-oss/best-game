// Keyboard and mouse state for Void Tide, in game (arena) coordinates. The main
// loop asks this what the player is doing; it never touches game logic itself.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    // Clicks are queued so a single press is never read twice by two screens.
    this.clickQueue = [];
    this._pressed = new Set();

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(key);
      this._pressed.add(key);
    });
    window.addEventListener('keyup', (e) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(key);
    });
    canvas.addEventListener('mousemove', (e) => {
      const p = this._toArena(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('mousedown', (e) => {
      const p = this._toArena(e.clientX, e.clientY);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      this.mouse.down = true;
      this.clickQueue.push({ x: p.x, y: p.y });
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
  }

  // The canvas is letterboxed to keep the 1280x720 arena; map a client point
  // back into arena coordinates.
  _toArena(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const ox = (rect.width - 1280 * scale) / 2;
    const oy = (rect.height - 720 * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale,
    };
  }

  // True only on the frame the key went down (for menus and one-shot actions).
  wasPressed(key) {
    return this._pressed.has(key);
  }

  // Held movement, as a unit vector (zero when no direction is held).
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('w') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('s') || this.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  // Drain the queued clicks from this frame.
  takeClicks() {
    const clicks = this.clickQueue;
    this.clickQueue = [];
    return clicks;
  }

  // Call at the end of each frame so wasPressed() is fresh next frame.
  endFrame() {
    this._pressed.clear();
  }
}
