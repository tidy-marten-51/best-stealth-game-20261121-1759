// The intruder: movement, stance and noise. The player is a circle that slides
// along cover instead of sticking to it, and every step it takes while sprinting
// rings out far enough for a nearby warden to hear.
import { PLAYER } from './config.js';

/** A fresh player at the archive's service door. */
export function createPlayer(x, y) {
  return {
    x,
    y,
    facing: -Math.PI / 2,
    crouch: false,
    sprinting: false,
    moving: false,
    /** Seconds since the last sprint noise pulse. */
    noiseTimer: 0,
    /** How far the last footstep carried, for the renderer. */
    lastNoiseRadius: 0,
  };
}

/**
 * Slide a circle of `radius` from (x, y) by (dx, dy), stopping at any rectangle
 * in `walls`. Each axis is tried on its own, so the circle slides along a wall
 * instead of catching on its corner.
 */
export function moveWithWalls(x, y, dx, dy, radius, walls) {
  let nextX = x + dx;
  for (let index = 0; index < walls.length; index += 1) {
    if (circleHitsRect(nextX, y, radius, walls[index])) {
      nextX = dx > 0 ? walls[index].x - radius : walls[index].x + walls[index].width + radius;
    }
  }
  let nextY = y + dy;
  for (let index = 0; index < walls.length; index += 1) {
    if (circleHitsRect(nextX, nextY, radius, walls[index])) {
      nextY = dy > 0 ? walls[index].y - radius : walls[index].y + walls[index].height + radius;
    }
  }
  return { x: nextX, y: nextY };
}

function circleHitsRect(cx, cy, radius, rect) {
  const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * Advance the player one step. `input` is { x, y, sprint, crouch } with x/y in
 * [-1, 1]. Returns a noise event ({ x, y, radius }) when a sprinting step rings
 * out, or null when the player moved quietly.
 */
export function updatePlayer(player, input, dt, walls) {
  const length = Math.hypot(input.x, input.y);
  const nx = length > 0 ? input.x / length : 0;
  const ny = length > 0 ? input.y / length : 0;
  player.crouch = input.crouch && !input.sprint;
  player.sprinting = input.sprint && !player.crouch && length > 0;
  const speed = player.crouch ? PLAYER.crouchSpeed : player.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  player.moving = length > 0;
  if (length > 0) player.facing = Math.atan2(ny, nx);
  const moved = moveWithWalls(player.x, player.y, nx * speed * dt, ny * speed * dt, 13, walls);
  player.x = moved.x;
  player.y = moved.y;

  player.lastNoiseRadius = 0;
  if (!player.sprinting) {
    player.noiseTimer = 0;
    return null;
  }
  player.noiseTimer += dt;
  if (player.noiseTimer < PLAYER.sprintNoiseInterval) return null;
  player.noiseTimer = 0;
  player.lastNoiseRadius = PLAYER.sprintNoiseRadius;
  return { x: player.x, y: player.y, radius: PLAYER.sprintNoiseRadius };
}
