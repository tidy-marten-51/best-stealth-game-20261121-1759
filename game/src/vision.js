// Vision: what a guard can see. A guard sees the player when the player is inside
// the guard's cone, close enough, and no cover rectangle blocks the line between
// them. Shadows and crouching do not hide the player outright; they slow how fast
// the guard becomes sure.
import { GUARD } from './config.js';

/** True when the segment from (x1, y1) to (x2, y2) crosses any rectangle in `walls`. */
export function segmentBlocked(x1, y1, x2, y2, walls) {
  for (let index = 0; index < walls.length; index += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, walls[index])) return true;
  }
  return false;
}

/** True when the point is inside one of the dark floor patches. */
export function pointInShadow(x, y, shadows) {
  for (let index = 0; index < shadows.length; index += 1) {
    const zone = shadows[index];
    if (x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height) return true;
  }
  return false;
}

/**
 * How fast this guard's certainty grows right now, per second. Zero when the
 * player is outside the cone, out of range, or behind cover; otherwise a rate
 * that is faster up close, slower while the player crouches or hides in shadow,
 * and faster while the player sprints.
 */
export function detectionRate(guard, player, walls, shadows) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > GUARD.sightRange) return 0;
  const angleToPlayer = Math.atan2(dy, dx);
  let angleDiff = Math.abs(angleToPlayer - guard.facing);
  if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;
  if (angleDiff > GUARD.sightHalfAngle) return 0;
  if (segmentBlocked(guard.x, guard.y, player.x, player.y, walls)) return 0;
  // Close is damning, the edge of the cone is a whisper.
  let rate = 1.35 * (1 - (distance / GUARD.sightRange) * 0.55);
  if (player.crouch) rate *= 0.42;
  if (pointInShadow(player.x, player.y, shadows)) rate *= 0.55;
  if (player.sprinting) rate *= 1.3;
  return rate;
}

/** The cone's far edge, for drawing: the guard, the range and the half-angle. */
export function conePoints(guard) {
  return {
    x: guard.x,
    y: guard.y,
    range: GUARD.sightRange,
    start: guard.facing - GUARD.sightHalfAngle,
    end: guard.facing + GUARD.sightHalfAngle,
  };
}

// --- segment / rectangle geometry -------------------------------------------

function segmentHitsRect(x1, y1, x2, y2, rect) {
  // A segment starting inside the rectangle hits it at once.
  if (x1 >= rect.x && x1 <= rect.x + rect.width && y1 >= rect.y && y1 <= rect.y + rect.height) return true;
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  return (
    segmentsCross(x1, y1, x2, y2, left, top, right, top) ||
    segmentsCross(x1, y1, x2, y2, right, top, right, bottom) ||
    segmentsCross(x1, y1, x2, y2, right, bottom, left, bottom) ||
    segmentsCross(x1, y1, x2, y2, left, bottom, left, top)
  );
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const d1 = direction(cx, cy, dx, dy, ax, ay);
  const d2 = direction(cx, cy, dx, dy, bx, by);
  const d3 = direction(ax, ay, bx, by, cx, cy);
  const d4 = direction(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function direction(px, py, qx, qy, rx, ry) {
  return (rx - px) * (qy - py) - (ry - py) * (qx - px);
}
