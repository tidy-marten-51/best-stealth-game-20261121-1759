// The Meridian Archive: one seeded night, one floor. The layout is fixed by
// design — shelves and crates for cover, dark floor patches to hide in, three
// ledger pages to steal and one exit door — and a small seeded jitter keeps the
// exact patrol starts honest while every screenshot stays reproducible.
import { EXIT, FIELD, PAGES_TO_WIN, PLAYER, STEP } from './config.js';
import { createPlayer, updatePlayer } from './player.js';
import { GUARD_CHASE, createGuard, updateGuard } from './guards.js';
import { pointInShadow } from './vision.js';

export const STATUS_PLAYING = 'playing';
export const STATUS_CAUGHT = 'caught';
export const STATUS_WON = 'won';

/** A tiny deterministic generator: the same seed always builds the same night. */
export function createRandom(seed) {
  let state = seed >>> 0 || 1;
  return function random() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** The archive's cover: shelves and crates block movement and line of sight. */
function buildWalls(random) {
  const jitter = () => (random() - 0.5) * 14;
  const walls = [
    // The outer shell (the doorways are gaps the renderer draws, not holes here:
    // the player starts inside, the exit is a zone, so the shell is solid).
    { x: 0, y: 0, width: FIELD.width, height: 24 },
    { x: 0, y: FIELD.height - 24, width: FIELD.width, height: 24 },
    { x: 0, y: 0, width: 24, height: FIELD.height },
    { x: FIELD.width - 24, y: 0, width: 24, height: FIELD.height },
    // West archive stacks.
    { x: 296 + jitter(), y: 96, width: 42, height: 210 },
    { x: 296 + jitter(), y: 420, width: 42, height: 180 },
    // Reading-hall stacks.
    { x: 556 + jitter(), y: 84, width: 42, height: 170 },
    { x: 556 + jitter(), y: 470, width: 42, height: 150 },
    { x: 430, y: 300 + jitter(), width: 150, height: 38 },
    { x: 700, y: 300 + jitter(), width: 150, height: 38 },
    // East vault stacks.
    { x: 816 + jitter(), y: 120, width: 42, height: 200 },
    { x: 816 + jitter(), y: 420, width: 42, height: 180 },
    // Crates: low cover in the open floor.
    { x: 200, y: 330, width: 52, height: 52 },
    { x: 640, y: 560, width: 52, height: 52 },
    { x: 980, y: 330, width: 52, height: 52 },
    { x: 1080, y: 520, width: 52, height: 52 },
  ];
  return walls;
}

/** Dark floor patches: being seen there is half as fast. */
function buildShadows() {
  return [
    { x: 360, y: 60, width: 170, height: 130 },
    { x: 60, y: 420, width: 190, height: 150 },
    { x: 660, y: 90, width: 150, height: 130 },
    { x: 900, y: 470, width: 180, height: 130 },
    { x: 1060, y: 90, width: 150, height: 120 },
  ];
}

function buildPages() {
  return [
    { x: 150, y: 140, taken: false },
    { x: 640, y: 130, taken: false },
    { x: 1120, y: 330, taken: false },
  ];
}

function buildGuards() {
  return [
    createGuard([
      { x: 130, y: 110 },
      { x: 250, y: 110 },
      { x: 250, y: 560 },
      { x: 130, y: 560 },
    ]),
    createGuard([
      { x: 450, y: 380 },
      { x: 850, y: 380 },
      { x: 850, y: 640 },
      { x: 450, y: 640 },
    ]),
    createGuard([
      { x: 950, y: 130 },
      { x: 1150, y: 130 },
      { x: 1150, y: 560 },
      { x: 950, y: 560 },
    ]),
    createGuard([
      { x: 420, y: 60 },
      { x: 900, y: 60 },
    ]),
  ];
}

/**
 * The world: the level, the player, the wardens, the pages and the clock.
 * `step` advances the real rules; `reset` rebuilds the same seeded night.
 */
export function createWorld(random) {
  const world = {
    state: null,
    random,
    reset() {
      const walls = buildWalls(random);
      world.state = {
        time: 0,
        status: STATUS_PLAYING,
        walls,
        shadows: buildShadows(),
        pages: buildPages(),
        pagesCollected: 0,
        player: createPlayer(80, 640),
        guards: buildGuards(),
        pings: [],
        exit: { ...EXIT },
        /** The loudest guard certainty right now: the HUD's alert meter. */
        alert: 0,
        /** Seconds the night has run since the last reset. */
        caughtBy: null,
        winTime: null,
        /** True while any guard is giving chase. */
        anyChase: false,
      };
    },
    /**
     * Advance the night by `dt` seconds. `input` is the player's move
     * ({ x, y, sprint, crouch }) and `ping` is a click point { x, y } or null.
     * Returns an event word: 'caught', 'won', 'chase' (a guard just gave
     * chase), 'page' (a ledger page was taken), or null.
     */
    step(dt, input, ping) {
      const state = world.state;
      if (state.status !== STATUS_PLAYING) return state.status;
      state.time += dt;

      if (ping) {
        state.pings.push({ x: ping.x, y: ping.y, radius: 175, ttl: 0.9, fresh: true });
      }
      const noise = updatePlayer(state.player, input, dt, state.walls);
      if (noise) state.pings.push({ x: noise.x, y: noise.y, radius: noise.radius, ttl: 0.5, fresh: true });

      let event = null;
      state.anyChase = false;
      for (let index = 0; index < state.guards.length; index += 1) {
        const guard = state.guards[index];
        const result = updateGuard(guard, dt, state);
        if (guard.justChased) event = 'chase';
        if (guard.state === GUARD_CHASE) state.anyChase = true;
        if (result === 'caught') {
          state.status = STATUS_CAUGHT;
          state.caughtBy = index;
          return 'caught';
        }
      }
      state.alert = 0;
      for (let index = 0; index < state.guards.length; index += 1) {
        state.alert = Math.max(state.alert, state.guards[index].detection);
      }

      for (let index = 0; index < state.pings.length; index += 1) {
        state.pings[index].ttl -= dt;
        state.pings[index].fresh = false;
      }
      state.pings = state.pings.filter((pingItem) => pingItem.ttl > 0);

      for (let index = 0; index < state.pages.length; index += 1) {
        const page = state.pages[index];
        if (page.taken) continue;
        if (Math.hypot(state.player.x - page.x, state.player.y - page.y) < PLAYER.radius + 20) {
          page.taken = true;
          state.pagesCollected += 1;
          event = 'page';
        }
      }

      const exit = state.exit;
      const inExit =
        state.player.x > exit.x - 6 &&
        state.player.x < exit.x + exit.width + 6 &&
        state.player.y > exit.y - 6 &&
        state.player.y < exit.y + exit.height + 6;
      if (inExit && state.pagesCollected >= PAGES_TO_WIN) {
        state.status = STATUS_WON;
        state.winTime = state.time;
        return 'won';
      }
      return event;
    },
  };
  world.reset();
  return world;
}

/** True when the player stands in shadow right now (for the HUD hint). */
export function playerInShadow(state) {
  return pointInShadow(state.player.x, state.player.y, state.shadows);
}

export { STEP };
