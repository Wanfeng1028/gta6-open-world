// Keyboard + mouse input. Tracks held keys, the mouse position in screen
// space, and edge-triggered presses the game loop consumes once per frame.
export class Keys {
  constructor(canvas) {
    this.held = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, down: false, clicked: false };
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.held.add(e.code);
      this.anyKey = true;
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => { this.held.clear(); this.mouse.down = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  is(code) { return this.held.has(code); }
  hit(code) { return this.pressed.has(code); }
  axis(neg, pos) { return (this.is(pos) ? 1 : 0) - (this.is(neg) ? 1 : 0); }

  // WASD / arrows as a normalised {x, y} walk vector.
  walkVector() {
    const x = this.axis('KeyA', 'KeyD') + this.axis('ArrowLeft', 'ArrowRight');
    const y = this.axis('KeyW', 'KeyS') + this.axis('ArrowUp', 'ArrowDown');
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len, active: x !== 0 || y !== 0 };
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.anyKey = false;
  }
}
