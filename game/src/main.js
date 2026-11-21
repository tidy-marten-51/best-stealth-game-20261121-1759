// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between five screens: title,
// play, paused, caught and won.
//
// ?seed=N fixes the night's jitter. ?shot=start|play|chase|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, DEFAULT_SEED, STEP } from './config.js';
import { createRandom, createWorld, STATUS_CAUGHT, STATUS_WON } from './level.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CAUGHT, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WON } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Footsteps sound at most this often, in seconds. */
const STEP_SOUND_INTERVAL = 0.34;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : DEFAULT_SEED;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseFloat(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(scene.screen, world.state, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, renderer.toField);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let stepSoundTimer = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    stepSoundTimer = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Steal three ledger pages, then leave by the green exit.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WON : SCREEN_CAUGHT;
    if (won) {
      audio.win();
      if (best === 0 || world.state.winTime < best) {
        best = world.state.winTime;
        saveBest(best);
      }
      announce(`Clean getaway in ${best.toFixed(1)} seconds.`);
    } else {
      audio.caught();
      announce(`Caught. ${world.state.pagesCollected} of 3 pages stolen.`);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_WON)) {
      audio.ensure();
      audio.click();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The wardens walk their routes behind the title, as in the staged shot.
      world.step(STEP, { x: 0, y: 0, sprint: false, crouch: false }, null);
      return;
    }
    const click = input.takeClick();
    const ping = click && screen === SCREEN_PLAY ? click : null;
    if (ping) audio.click();
    const move = input.move();
    const event = world.step(STEP, move, ping);
    const player = world.state.player;
    if (player.moving && screen === SCREEN_PLAY) {
      stepSoundTimer -= STEP;
      if (stepSoundTimer <= 0) {
        stepSoundTimer = STEP_SOUND_INTERVAL * (player.crouch ? 1.5 : player.sprinting ? 0.7 : 1);
        audio.footstep(player.sprinting);
      }
    }
    if (event === 'chase') audio.alarm();
    else if (event === 'page') audio.page();
    if (world.state.status === STATUS_WON) endGame(true);
    else if (world.state.status === STATUS_CAUGHT) endGame(false);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(screen, world.state, best);
  }

  // Leaving the tab pauses a running game rather than letting wardens close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Shadow Ledger. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
