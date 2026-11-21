// Input: keyboard and mouse, read every frame. WASD or arrows move, Shift
// sprints, C (or Ctrl) crouches, M mutes, P or Escape pauses, Enter or Space
// confirms a menu, and a click during play throws a distraction ping at that
// spot on the floor (a click on a menu confirms it instead).
import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

/**
 * `toField` converts a mouse position on the canvas into playfield pixels;
 * the renderer hands it in because only it knows the current scale.
 */
export function createInput(canvas, toField) {
  const keys = new Set();
  let actions = 0;
  let click = null;
  let lastClickAt = 0;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.repeat) return;
    keys.add(codeOf(event));
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(codeOf(event));
  });
  window.addEventListener('blur', () => {
    keys.clear();
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const point = toField(event.clientX - rect.left, event.clientY - rect.top);
    if (point) {
      click = point;
      lastClickAt = performance.now();
    }
    actions |= ACTION_CONFIRM;
  });

  return {
    /** The movement vector and stance for this frame. */
    move() {
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      const up = keys.has('KeyW') || keys.has('ArrowUp');
      const down = keys.has('KeyS') || keys.has('ArrowDown');
      return {
        x: (right ? 1 : 0) - (left ? 1 : 0),
        y: (down ? 1 : 0) - (up ? 1 : 0),
        sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
        crouch: keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight'),
      };
    },
    /** One-shot actions since the last read; reading clears them. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The latest click point in field pixels, or null; reading clears it. */
    takeClick() {
      // A click older than a frame is stale: menus and pings read it at once.
      if (!click || performance.now() - lastClickAt > 1000) {
        click = null;
        return null;
      }
      const point = click;
      click = null;
      return point;
    },
    /** True while the player is inside the field (for the renderer). */
    fieldOf(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return toField(clientX - rect.left, clientY - rect.top);
    },
  };
}

/** The field is 1280x720; this helper is unused by the game and kept for tests. */
export function clampToField(x, y) {
  return {
    x: Math.max(0, Math.min(FIELD.width, x)),
    y: Math.max(0, Math.min(FIELD.height, y)),
  };
}
