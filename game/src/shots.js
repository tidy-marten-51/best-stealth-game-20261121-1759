// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the
// real rules forward from a fresh seeded world, steered by a small autopilot
// that plans a route on a coarse grid with A* — shelves and walls are
// unwalkable, and in careful mode every cell a warden can see costs extra —
// then replans as the wardens move. The frame is what a real game looks
// like, and the same seed always gives the same frame.
import { FIELD, PAGES_TO_WIN, STEP } from './config.js';
import { detectionRate } from './vision.js';
import { moveWithWalls } from './player.js';
import { STATUS_CAUGHT, STATUS_WON } from './level.js';
import { SCREEN_CAUGHT, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 12;
const END_LIMIT_SECONDS = 600;
const SAMPLE = STEP;
/** The autopilot's planning grid, in pixels per cell. */
const CELL = 32;
/** How often the pilot replans its route, in steps. */
const REPLAN_EVERY = 40;
/** Extra route cost per unit of guard certainty in careful mode. */
const DANGER_WEIGHT = 70;

const COLS = Math.ceil(FIELD.width / CELL);
const ROWS = Math.ceil(FIELD.height / CELL);

/** The autopilot's goal right now: the nearest page it has not taken, else the exit. */
function currentTarget(state) {
  let best = null;
  let bestDistance = Infinity;
  for (let index = 0; index < state.pages.length; index += 1) {
    const page = state.pages[index];
    if (page.taken) continue;
    const distance = Math.hypot(page.x - state.player.x, page.y - state.player.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = page;
    }
  }
  if (best) return best;
  return { x: state.exit.x + state.exit.width / 2, y: state.exit.y + state.exit.height / 2 };
}

function cellCentre(col, row) {
  return { x: col * CELL + CELL / 2, y: row * CELL + CELL / 2 };
}

function cellOf(x, y) {
  return {
    col: Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))),
    row: Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL))),
  };
}

/** True when a cell's centre is far enough from every wall to stand in. */
function cellWalkable(col, row, walls) {
  const centre = cellCentre(col, row);
  for (let index = 0; index < walls.length; index += 1) {
    const wall = walls[index];
    if (
      centre.x > wall.x - 14 &&
      centre.x < wall.x + wall.width + 14 &&
      centre.y > wall.y - 14 &&
      centre.y < wall.y + wall.height + 14
    ) {
      return false;
    }
  }
  return true;
}

/** How dangerous standing in a cell is: the fastest certainty any guard gains there. */
function cellDanger(state, col, row) {
  const centre = cellCentre(col, row);
  const probe = { x: centre.x, y: centre.y, crouch: false, sprinting: false };
  let worst = 0;
  for (let index = 0; index < state.guards.length; index += 1) {
    worst = Math.max(worst, detectionRate(state.guards[index], probe, state.walls, state.shadows));
  }
  return worst;
}

/**
 * A* from the player's cell to the target's cell. `dangerWeight` 0 plans the
 * shortest route whatever the cones; a high weight plans the unseen route.
 * Returns a list of { x, y } waypoints, or null when no route exists.
 */
function planRoute(state, target, dangerWeight) {
  const start = cellOf(state.player.x, state.player.y);
  const goal = cellOf(target.x, target.y);
  const key = (col, row) => row * COLS + col;
  const open = [{ col: start.col, row: start.row, g: 0, f: 0, parent: null }];
  const bestG = new Map();
  bestG.set(key(start.col, start.row), 0);
  const closed = new Set();
  const heuristic = (col, row) => Math.hypot(goal.col - col, goal.row - row);

  while (open.length > 0) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      if (open[index].f < open[bestIndex].f) bestIndex = index;
    }
    const node = open.splice(bestIndex, 1)[0];
    const nodeKey = key(node.col, node.row);
    if (closed.has(nodeKey)) continue;
    closed.add(nodeKey);
    if (node.col === goal.col && node.row === goal.row) {
      const path = [];
      let cursor = node;
      while (cursor) {
        path.unshift(cellCentre(cursor.col, cursor.row));
        cursor = cursor.parent;
      }
      return path;
    }
    for (let dc = -1; dc <= 1; dc += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (dc === 0 && dr === 0) continue;
        const col = node.col + dc;
        const row = node.row + dr;
        if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
        if (!cellWalkable(col, row, state.walls)) continue;
        // A diagonal step must not cut a wall's corner.
        if (dc !== 0 && dr !== 0 && (!cellWalkable(node.col + dc, node.row, state.walls) || !cellWalkable(node.col, node.row + dr, state.walls))) continue;
        const stepCost = dc !== 0 && dr !== 0 ? 1.414 : 1;
        const danger = dangerWeight > 0 ? cellDanger(state, col, row) * dangerWeight : 0;
        const g = node.g + stepCost + danger;
        const neighbourKey = key(col, row);
        if (bestG.has(neighbourKey) && bestG.get(neighbourKey) <= g) continue;
        bestG.set(neighbourKey, g);
        open.push({ col, row, g, f: g + heuristic(col, row), parent: node });
      }
    }
  }
  return null;
}

/** The pilot: a route, how far along it the player is, and when to replan. */
function createPilot() {
  return { route: null, waypoint: 0, stepsSincePlan: REPLAN_EVERY, target: null };
}

/** The next input: follow the route, replanning as the wardens move. */
function autopilot(state, pilot, careful) {
  const player = state.player;
  const target = currentTarget(state);
  const targetChanged = !pilot.target || pilot.target.x !== target.x || pilot.target.y !== target.y;
  pilot.stepsSincePlan += 1;
  if (!pilot.route || targetChanged || pilot.stepsSincePlan >= REPLAN_EVERY || pilot.waypoint >= pilot.route.length) {
    pilot.route = planRoute(state, target, careful ? DANGER_WEIGHT : 0);
    pilot.waypoint = 0;
    pilot.stepsSincePlan = 0;
    pilot.target = { x: target.x, y: target.y };
  }
  const nearGuard = state.guards.some((guard) => Math.hypot(guard.x - player.x, guard.y - player.y) < 300);
  const crouch = careful && (nearGuard || state.alert > 0.05);
  if (!pilot.route || pilot.route.length === 0) return { x: 0, y: 0, sprint: false, crouch };
  let waypoint = pilot.route[pilot.waypoint];
  while (pilot.waypoint < pilot.route.length - 1 && Math.hypot(waypoint.x - player.x, waypoint.y - player.y) < 14) {
    pilot.waypoint += 1;
    waypoint = pilot.route[pilot.waypoint];
  }
  const dx = waypoint.x - player.x;
  const dy = waypoint.y - player.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length, sprint: false, crouch };
}

/** The next input while fleeing: the step that puts the most distance between the player and the nearest chasing warden, walls included. */
function fleeInput(state) {
  const player = state.player;
  let chaser = null;
  let nearest = Infinity;
  for (let index = 0; index < state.guards.length; index += 1) {
    const guard = state.guards[index];
    const distance = Math.hypot(guard.x - player.x, guard.y - player.y);
    if (guard.state === 'chase' && distance < nearest) {
      nearest = distance;
      chaser = guard;
    }
  }
  if (!chaser) return { x: 0, y: 0, sprint: true, crouch: false };
  const directions = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  let best = directions[0];
  let bestDistance = -Infinity;
  for (let index = 0; index < directions.length; index += 1) {
    const direction = directions[index];
    const length = Math.hypot(direction[0], direction[1]);
    const moved = moveWithWalls(
      player.x,
      player.y,
      (direction[0] / length) * 265 * SAMPLE,
      (direction[1] / length) * 265 * SAMPLE,
      13,
      state.walls,
    );
    const distance = Math.hypot(chaser.x - moved.x, chaser.y - moved.y);
    if (distance > bestDistance) {
      bestDistance = distance;
      best = direction;
    }
  }
  return { x: best[0], y: best[1], sprint: true, crouch: false };
}
function runPilot(world, careful, seconds, stop) {
  const pilot = createPilot();
  const limit = Math.floor(seconds / SAMPLE);
  for (let index = 0; index < limit; index += 1) {
    const state = world.state;
    if (state.status !== 'playing') break;
    const input = autopilot(state, pilot, careful);
    world.step(SAMPLE, input, null);
    if (stop && stop(world.state)) break;
  }
}

/**
 * Set `world` to the named scene (start, play, chase or end; any other name is
 * start) and return the screen to draw over it and the best time to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'chase' && name !== 'end') {
    // Title: the wardens walk their routes behind the menu for a few seconds.
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { x: 0, y: 0, sprint: false, crouch: false }, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    runPilot(world, true, PLAY_SECONDS, null);
    return { screen: world.state.status === STATUS_CAUGHT ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    // Reckless: take the shortest route at the pages, ignoring the cones,
    // until a warden grows suspicious — then stand in its lamplight while
    // its certainty hardens into a chase, sprinting away the moment it
    // commits (or the moment it gets close enough to seize the intruder).
    runPilot(world, false, 45, (state) => state.alert > 0.35);
    const state = world.state;
    if (state.alert > 0.35 && state.status === 'playing') {
      for (let index = 0; index < 90 && state.status === 'playing' && !state.anyChase; index += 1) {
        const nearest = Math.min(...state.guards.map((guard) => Math.hypot(guard.x - state.player.x, guard.y - state.player.y)));
        if (nearest < 45) break;
        world.step(SAMPLE, { x: 0, y: 0, sprint: false, crouch: false }, null);
      }
    }
    if (state.status === 'playing' && (state.anyChase || state.alert > 0.35)) {
      // Sprint away from the chasing warden for three quarters of a second:
      // the frame catches the chase mid-alarm, the warden closing in behind
      // the intruder.
      for (let index = 0; index < 45; index += 1) {
        world.step(SAMPLE, fleeInput(state), null);
        if (state.status !== 'playing') break;
      }
    }
    return { screen: state.status === STATUS_CAUGHT ? SCREEN_CAUGHT : SCREEN_PLAY, best: 0 };
  }
  // end: the careful pilot plays the whole night until it wins.
  runPilot(world, true, END_LIMIT_SECONDS, (state) => state.status === STATUS_WON);
  const state = world.state;
  if (state.status === STATUS_WON) return { screen: SCREEN_WON, best: state.winTime };
  return { screen: SCREEN_PLAY, best: 0 };
}

export { PAGES_TO_WIN, FIELD };
