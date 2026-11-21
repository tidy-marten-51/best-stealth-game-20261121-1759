// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Top-down, at night: a dark archive floor,
// shelves and crates as cover, amber vision cones, and the intruder in teal.
import { FIELD, FONT, PAGES_TO_WIN, PALETTE } from './config.js';
import { GUARD_CHASE, GUARD_SUSPICIOUS } from './guards.js';
import { conePoints } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WON = 'won';

const PANEL = { width: 640, top: 118, line: 36, bottom: 78 };

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const pagesLabel = cachedLabel('Pages ');
  const timeLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Canvas pixels (relative to the canvas) back to playfield pixels, or null outside. */
  function toField(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    const x = (clientX * ratio - view.x) / view.scale;
    const y = (clientY * ratio - view.y) / view.scale;
    if (x < 0 || x > FIELD.width || y < 0 || y > FIELD.height) return null;
    return { x, y };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${rest < 10 ? '0' : ''}${rest}`;
  }

  function drawFloor(state) {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Parquet tiles: faint squares so the floor reads as boards, not void.
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    for (let x = 0; x <= FIELD.width; x += 80) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
      context.stroke();
    }
    for (let y = 0; y <= FIELD.height; y += 80) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
      context.stroke();
    }
    context.fillStyle = PALETTE.floorTile;
    for (let x = 40; x < FIELD.width; x += 160) {
      for (let y = 40; y < FIELD.height; y += 160) {
        context.fillRect(x, y, 4, 4);
      }
    }
    // Shadow patches: dark floor where a guard's eyes are half as quick.
    for (let index = 0; index < state.shadows.length; index += 1) {
      const zone = state.shadows[index];
      context.fillStyle = PALETTE.shadowZone;
      context.fillRect(zone.x, zone.y, zone.width, zone.height);
      context.strokeStyle = PALETTE.shadowEdge;
      context.lineWidth = 2;
      context.strokeRect(zone.x, zone.y, zone.width, zone.height);
    }
  }

  function drawCover(state) {
    for (let index = 0; index < state.walls.length; index += 1) {
      const wall = state.walls[index];
      const outer = index < 4;
      context.fillStyle = outer ? PALETTE.wall : PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.width, wall.height);
      if (!outer) {
        // Shelf slats: three pale lines down a bookcase, two across a crate.
        context.strokeStyle = 'rgba(20, 14, 8, 0.5)';
        context.lineWidth = 2;
        const tall = wall.height > wall.width;
        for (let line = 1; line <= 2; line += 1) {
          context.beginPath();
          if (tall) {
            const y = wall.y + (wall.height * line) / 3;
            context.moveTo(wall.x + 4, y);
            context.lineTo(wall.x + wall.width - 4, y);
          } else {
            const x = wall.x + (wall.width * line) / 3;
            context.moveTo(x, wall.y + 4);
            context.lineTo(x, wall.y + wall.height - 4);
          }
          context.stroke();
        }
      }
    }
    // Crates are the small square walls; give them a lid line so they read.
    context.strokeStyle = PALETTE.crateTop;
    context.lineWidth = 3;
    for (let index = 4; index < state.walls.length; index += 1) {
      const wall = state.walls[index];
      if (wall.width !== 52 || wall.height !== 52) continue;
      context.strokeRect(wall.x + 5, wall.y + 5, wall.width - 10, wall.height - 10);
    }
  }

  function drawExit(state) {
    const exit = state.exit;
    const open = state.pagesCollected >= PAGES_TO_WIN;
    context.fillStyle = open ? PALETTE.exitOpen : PALETTE.exitClosed;
    context.fillRect(exit.x, exit.y, exit.width, exit.height);
    context.strokeStyle = open ? PALETTE.exitSign : '#5d7a68';
    context.lineWidth = 3;
    context.strokeRect(exit.x, exit.y, exit.width, exit.height);
    text(open ? 'EXIT' : 'LOCKED', exit.x + exit.width / 2, exit.y + exit.height / 2 + 5, 15, open ? PALETTE.exitSign : '#8fa596', 'center');
    if (open) {
      // A green spill of light when the door is ready.
      context.fillStyle = 'rgba(47, 158, 95, 0.18)';
      context.fillRect(exit.x - 30, exit.y + exit.height, exit.width + 60, 46);
    }
  }

  function drawPages(state) {
    for (let index = 0; index < state.pages.length; index += 1) {
      const page = state.pages[index];
      if (page.taken) continue;
      const pulse = 0.5 + 0.5 * Math.sin(state.time * 3 + index * 2);
      context.fillStyle = `rgba(242, 201, 76, ${0.14 + pulse * 0.14})`;
      context.beginPath();
      context.arc(page.x, page.y, 30 + pulse * 6, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.page;
      context.fillRect(page.x - 9, page.y - 12, 18, 24);
      context.strokeStyle = '#8a6d1f';
      context.lineWidth = 1.5;
      for (let line = 0; line < 3; line += 1) {
        context.beginPath();
        context.moveTo(page.x - 5, page.y - 6 + line * 6);
        context.lineTo(page.x + 5, page.y - 6 + line * 6);
        context.stroke();
      }
    }
  }

  function drawGuards(state) {
    for (let index = 0; index < state.guards.length; index += 1) {
      const guard = state.guards[index];
      const cone = conePoints(guard);
      const colour =
        guard.state === GUARD_CHASE
          ? PALETTE.coneChase
          : guard.state === GUARD_SUSPICIOUS
            ? PALETTE.coneSuspicious
            : PALETTE.coneCalm;
      context.fillStyle = colour;
      context.beginPath();
      context.moveTo(cone.x, cone.y);
      context.arc(cone.x, cone.y, cone.range, cone.start, cone.end);
      context.closePath();
      context.fill();
      context.strokeStyle = PALETTE.coneEdge;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(cone.x, cone.y);
      context.arc(cone.x, cone.y, cone.range, cone.start, cone.end);
      context.closePath();
      context.stroke();

      // The warden: a red disc with a facing tick and a lamp dot.
      context.fillStyle = guard.state === GUARD_CHASE ? PALETTE.guardAlert : PALETTE.guardCalm;
      context.beginPath();
      context.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#2b0d0b';
      context.lineWidth = 2;
      context.stroke();
      context.strokeStyle = '#ffd9d4';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.facing) * 18, guard.y + Math.sin(guard.facing) * 18);
      context.stroke();
      context.fillStyle = '#fff3c4';
      context.beginPath();
      context.arc(guard.x + Math.cos(guard.facing) * 10, guard.y + Math.sin(guard.facing) * 10, 2.5, 0, Math.PI * 2);
      context.fill();

      // Detection ring over a guard that is growing sure.
      if (guard.detection > 0.05) {
        context.strokeStyle = guard.detection > 0.7 ? PALETTE.hudDanger : PALETTE.hudGold;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(guard.x, guard.y, 21, -Math.PI / 2, -Math.PI / 2 + guard.detection * Math.PI * 2);
        context.stroke();
      }
      if (guard.state === GUARD_SUSPICIOUS) text('?', guard.x, guard.y - 26, 22, PALETTE.hudGold, 'center');
      if (guard.state === GUARD_CHASE) text('!', guard.x, guard.y - 26, 24, PALETTE.hudDanger, 'center');
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    // A sprint rings out: the noise circle shows how far the sound carries.
    if (player.lastNoiseRadius > 0) {
      context.strokeStyle = 'rgba(120, 200, 255, 0.45)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(player.x, player.y, player.lastNoiseRadius, 0, Math.PI * 2);
      context.stroke();
    }
    context.fillStyle = player.crouch ? PALETTE.playerDark : PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, player.crouch ? 10 : 13, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#062a28';
    context.lineWidth = 2;
    context.stroke();
    context.strokeStyle = '#d9fffb';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(player.x, player.y);
    context.lineTo(player.x + Math.cos(player.facing) * 17, player.y + Math.sin(player.facing) * 17);
    context.stroke();
  }

  function drawPings(state) {
    for (let index = 0; index < state.pings.length; index += 1) {
      const ping = state.pings[index];
      const progress = 1 - ping.ttl / 0.9;
      context.strokeStyle = PALETTE.ping;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ping.x, ping.y, 12 + progress * ping.radius * 0.6, 0, Math.PI * 2);
      context.stroke();
    }
  }

  function drawHud(state, best) {
    context.fillStyle = PALETTE.hudPanel;
    context.fillRect(0, 0, FIELD.width, 40);
    text(pagesLabel(state.pagesCollected) + ` / ${PAGES_TO_WIN} pages`, 16, 27, 18, PALETTE.hudGold, 'left');
    const alertText = state.anyChase ? 'HUNTED' : state.alert > 0.35 ? 'SUSPICIOUS' : state.alert > 0.05 ? 'SEEN?' : 'UNSEEN';
    const alertColour = state.anyChase ? PALETTE.hudDanger : state.alert > 0.35 ? PALETTE.hudGold : PALETTE.hudText;
    text(`ALERT ${alertText}`, FIELD.width / 2, 27, 18, alertColour, 'center');
    // The alert bar under the word: how sure the keenest warden is.
    context.fillStyle = '#2a2f3a';
    context.fillRect(FIELD.width / 2 - 90, 32, 180, 4);
    context.fillStyle = alertColour;
    context.fillRect(FIELD.width / 2 - 90, 32, 180 * Math.min(1, state.alert), 4);
    text(timeLabel(formatTime(state.time)), FIELD.width - 16, 27, 18, PALETTE.hudText, 'right');
    if (best > 0) text(`Best ${formatTime(best)}`, FIELD.width - 110, 27, 14, PALETTE.hudMuted, 'right');

    // Stance hint, bottom-left: what the player is doing right now.
    const stance = state.player.crouch ? 'CROUCHED — slow, quiet, hard to see' : state.player.sprinting ? 'SPRINTING — fast, loud' : 'WALKING';
    text(stance, 16, FIELD.height - 16, 14, PALETTE.hudMuted, 'left');
    text('WASD move · Shift sprint · C crouch · Click ping · M mute', FIELD.width - 16, FIELD.height - 16, 14, PALETTE.hudMuted, 'right');
  }

  function drawPanel(title, lines, prompt, titleColour) {
    const height = PANEL.top + PANEL.line * lines.length + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(5, 7, 10, 0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    text(title, FIELD.width / 2, y + 64, 44, titleColour, 'center');
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, y + 118 + index * PANEL.line, 19, PALETTE.hudText, 'center');
    });
    text(prompt, FIELD.width / 2, y + height - 30, 17, PALETTE.hudMuted, 'center');
  }

  function drawTitle(state, best) {
    drawFloor(state);
    drawCover(state);
    drawExit(state);
    drawPages(state);
    drawGuards(state);
    drawPlayer(state);
    context.fillStyle = 'rgba(5, 7, 10, 0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('SHADOW LEDGER', FIELD.width / 2, 190, 64, PALETTE.titleGold, 'center');
    text('Steal three ledger pages from the Meridian Archive — and leave unseen.', FIELD.width / 2, 232, 20, PALETTE.hudText, 'center');
    const lines = [
      'Wardens patrol with lantern cones. Stay out of the light, or behind cover.',
      'Crouch (C) to slip past slowly. Sprint (Shift) is fast — and loud.',
      'Click the floor to throw a ping and pull a warden away.',
      'Take all three pages, then slip out the green exit door.',
    ];
    lines.forEach((line, index) => {
      text(line, FIELD.width / 2, 300 + index * 30, 18, PALETTE.hudMuted, 'center');
    });
    if (best > 0) text(`Fastest clean getaway: ${formatTime(best)}`, FIELD.width / 2, 452, 18, PALETTE.titleTeal, 'center');
    text('Press Enter or click to begin', FIELD.width / 2, 510, 22, PALETTE.titleGold, 'center');
  }

  function draw(screen, state, best) {
    resize();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
      return;
    }
    drawFloor(state);
    drawCover(state);
    drawExit(state);
    drawPages(state);
    drawGuards(state);
    drawPlayer(state);
    drawPings(state);
    drawHud(state, best);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The archive waits. The wardens do not.'], 'Press P or Enter to keep sneaking', PALETTE.hudText);
    } else if (screen === SCREEN_CAUGHT) {
      drawPanel(
        'SPOTTED',
        ['A warden seized you in the lamplight.', `Pages stolen: ${state.pagesCollected} of ${PAGES_TO_WIN}.`, 'The ledger stays in the archive tonight.'],
        'Press Enter to try the night again',
        PALETTE.hudDanger,
      );
    } else if (screen === SCREEN_WON) {
      drawPanel(
        'CLEAN GETAWAY',
        [`All ${PAGES_TO_WIN} pages stolen in ${formatTime(state.winTime ?? state.time)}.`, 'The Meridian Archive never knew you were there.'],
        'Press Enter to run the night again',
        PALETTE.titleTeal,
      );
    }
  }

  return { draw, toField };
}
