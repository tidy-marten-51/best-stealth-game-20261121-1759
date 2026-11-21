// The wardens: patrol, suspicion, chase and search. A guard walks its route
// until its certainty about the intruder grows; then it stops and stares, then
// gives chase, then searches the last place it saw the intruder before giving
// up and walking its route again. A noise — a sprinting step, a thrown ping —
// pulls a calm guard over to look.
import { GUARD } from './config.js';
import { detectionRate } from './vision.js';
import { moveWithWalls } from './player.js';

export const GUARD_CALM = 'calm';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';

/** A fresh guard on its route: `waypoints` are { x, y } stops it walks in turn. */
export function createGuard(waypoints) {
  const first = waypoints[0];
  const second = waypoints[1] ?? first;
  return {
    x: first.x,
    y: first.y,
    facing: Math.atan2(second.y - first.y, second.x - first.x),
    waypoints,
    waypointIndex: 1 % waypoints.length,
    state: GUARD_CALM,
    /** 0 (never seen the intruder) to 1 (certain). */
    detection: 0,
    /** Where the guard last saw the intruder, or null. */
    lastSeen: null,
    /** Where a noise told the guard to look, or null. */
    investigate: null,
    /** Seconds left in the current stare or search. */
    stateTimer: 0,
    /** Seconds since the intruder was last seen while chasing. */
    unseenTimer: 0,
    /** True on the step the guard first gives chase (for the alarm sound). */
    justChased: false,
  };
}

/** Turn a guard toward a point, at most `turnRate` radians this step. */
function turnToward(guard, targetX, targetY, turnRate, dt) {
  const wanted = Math.atan2(targetY - guard.y, targetX - guard.x);
  let diff = wanted - guard.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  guard.facing += step;
}

function walkToward(guard, targetX, targetY, speed, dt, walls) {
  const dx = targetX - guard.x;
  const dy = targetY - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return true;
  turnToward(guard, targetX, targetY, 9, dt);
  const step = Math.min(speed * dt, distance);
  const moved = moveWithWalls(guard.x, guard.y, (dx / distance) * step, (dy / distance) * step, GUARD.radius, walls);
  guard.x = moved.x;
  guard.y = moved.y;
  return distance <= step + 1;
}

/**
 * Advance one guard one step. `world` is the level state (player, walls,
 * shadows, pings). Returns 'caught' when this guard seizes the intruder.
 */
export function updateGuard(guard, dt, world) {
  guard.justChased = false;
  const player = world.player;
  const rate = detectionRate(guard, player, world.walls, world.shadows);
  const seen = rate > 0;

  if (seen) {
    guard.detection = Math.min(1, guard.detection + rate * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    guard.unseenTimer = 0;
  } else {
    guard.detection = Math.max(0, guard.detection - GUARD.decayPerSecond * dt);
    if (guard.state === GUARD_CHASE) guard.unseenTimer += dt;
  }

  // A noise pulls a calm or suspicious guard over to look at where it came from.
  for (let index = 0; index < world.pings.length; index += 1) {
    const ping = world.pings[index];
    if (ping.fresh && (guard.state === GUARD_CALM || guard.state === GUARD_SUSPICIOUS)) {
      const distance = Math.hypot(ping.x - guard.x, ping.y - guard.y);
      if (distance < ping.radius + 40) {
        guard.investigate = { x: ping.x, y: ping.y };
        if (guard.state === GUARD_CALM) {
          guard.state = GUARD_SUSPICIOUS;
          guard.stateTimer = GUARD.suspiciousStareSeconds;
        }
      }
    }
  }

  if (guard.state === GUARD_CALM) {
    if (guard.detection >= GUARD.suspiciousAt) {
      guard.state = GUARD_SUSPICIOUS;
      guard.stateTimer = GUARD.suspiciousStareSeconds;
    } else if (guard.investigate) {
      if (walkToward(guard, guard.investigate.x, guard.investigate.y, GUARD.investigateSpeed, dt, world.walls)) {
        guard.investigate = null;
        guard.stateTimer = 1.2;
      }
    } else {
      const target = guard.waypoints[guard.waypointIndex];
      if (walkToward(guard, target.x, target.y, GUARD.patrolSpeed, dt, world.walls)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
      }
    }
    return null;
  }

  if (guard.state === GUARD_SUSPICIOUS) {
    if (guard.detection >= GUARD.chaseAt) {
      guard.state = GUARD_CHASE;
      guard.unseenTimer = 0;
      guard.justChased = true;
      return null;
    }
    if (seen) turnToward(guard, player.x, player.y, 6, dt);
    guard.stateTimer -= dt;
    if (guard.stateTimer <= 0) {
      if (guard.detection < GUARD.suspiciousAt * 0.6) {
        guard.state = GUARD_CALM;
        guard.investigate = null;
      } else if (guard.investigate) {
        guard.state = GUARD_CALM;
      } else {
        guard.state = GUARD_SEARCH;
        guard.stateTimer = GUARD.searchSeconds;
      }
    }
    return null;
  }

  if (guard.state === GUARD_CHASE) {
    if (seen) turnToward(guard, player.x, player.y, 10, dt);
    const target = guard.lastSeen ?? { x: player.x, y: player.y };
    walkToward(guard, target.x, target.y, GUARD.chaseSpeed, dt, world.walls);
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (distance < GUARD.catchDistance && guard.detection > 0.6) return 'caught';
    if (guard.unseenTimer > GUARD.chaseMemorySeconds) {
      guard.state = GUARD_SEARCH;
      guard.stateTimer = GUARD.searchSeconds;
    }
    return null;
  }

  // GUARD_SEARCH: walk to the last-seen spot, look around, then go back on patrol.
  if (guard.lastSeen && !guard.arrivedSearch) {
    if (walkToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.searchSpeed, dt, world.walls)) {
      guard.arrivedSearch = true;
    }
  } else {
    guard.facing += dt * 1.6;
    guard.stateTimer -= dt;
    if (guard.stateTimer <= 0) {
      guard.state = GUARD_CALM;
      guard.lastSeen = null;
      guard.arrivedSearch = false;
    }
  }
  if (guard.detection >= GUARD.chaseAt) {
    guard.state = GUARD_CHASE;
    guard.unseenTimer = 0;
    guard.justChased = true;
  }
  return null;
}
