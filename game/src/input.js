// Keyboard and mouse input: held keys, pressed-this-frame actions, and the
// mouse position in screen pixels (the renderer converts it to a world aim).

import { KEYS } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_SHOOT = 8;
export const ACTION_MUTE = 16;
export const ACTION_SAVE = 32;

const ALL_KEYS = new Set(Object.values(KEYS).flat());

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(event) {
    if (ALL_KEYS.has(event.code)) {
      event.preventDefault();
      if (!event.repeat) pressed.add(event.code);
      held.add(event.code);
    }
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.down = true;
    mouse.clicked = true;
  }
  function onMouseUp() {
    mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  function has(codes) {
    return codes.some((code) => held.has(code));
  }
  function wasPressed(codes) {
    return codes.some((code) => pressed.has(code));
  }

  return {
    mouse,
    direction() {
      let x = 0;
      let y = 0;
      if (has(KEYS.left)) x -= 1;
      if (has(KEYS.right)) x += 1;
      if (has(KEYS.up)) y -= 1;
      if (has(KEYS.down)) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    sprint() {
      return has(KEYS.sprint);
    },
    shooting() {
      return mouse.down || has(KEYS.shoot);
    },
    takeActions() {
      let actions = 0;
      if (wasPressed(KEYS.confirm) || mouse.clicked) actions |= ACTION_CONFIRM;
      if (wasPressed(KEYS.pause)) actions |= ACTION_PAUSE;
      if (wasPressed(KEYS.enter)) actions |= ACTION_ENTER;
      if (wasPressed(KEYS.shoot)) actions |= ACTION_SHOOT;
      if (wasPressed(KEYS.mute)) actions |= ACTION_MUTE;
      if (wasPressed(KEYS.save)) actions |= ACTION_SAVE;
      pressed.clear();
      mouse.clicked = false;
      return actions;
    },
  };
}
