// SHADOW LEDGER — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many ledger pages win the night. */
export const PAGES_TO_WIN = 3;

/** The seed every staged screenshot and the title-screen attract mode share. */
export const DEFAULT_SEED = 20261121;

export const PLAYER = {
  radius: 13,
  walkSpeed: 175,
  crouchSpeed: 92,
  sprintSpeed: 265,
  /** Noise a sprinting step makes, in pixels of radius. */
  sprintNoiseRadius: 135,
  /** Seconds between sprint noise pulses. */
  sprintNoiseInterval: 0.45,
};

export const GUARD = {
  radius: 14,
  patrolSpeed: 78,
  investigateSpeed: 105,
  chaseSpeed: 196,
  searchSpeed: 95,
  /** How far a guard can see, in pixels. */
  sightRange: 255,
  /** Half of the vision cone's angle, in radians. */
  sightHalfAngle: 0.61,
  /** Caught when a chasing guard gets this close, in pixels. */
  catchDistance: 26,
  /** Detection at which a guard stops and stares. */
  suspiciousAt: 0.35,
  /** Detection at which a guard gives chase. */
  chaseAt: 0.72,
  /** Detection lost per second while the player is unseen. */
  decayPerSecond: 0.5,
  /** Seconds unseen in chase before the guard falls back to searching. */
  chaseMemorySeconds: 3.5,
  /** Seconds a guard stares while suspicious before deciding. */
  suspiciousStareSeconds: 1.1,
  /** Seconds a guard looks around the last-seen spot while searching. */
  searchSeconds: 2.4,
};

/** A click ping distracts guards this far away, in pixels. */
export const PING_RADIUS = 175;

/** The exit door stays shut until every page is taken. */
export const EXIT = { x: 1188, y: 28, width: 64, height: 44 };

export const PALETTE = {
  backdrop: '#0a0d12',
  floor: '#1d212b',
  floorLine: '#232835',
  floorTile: '#20242f',
  wall: '#3a2f26',
  wallTop: '#54432f',
  crate: '#4a3a24',
  crateTop: '#6b5636',
  shadowZone: 'rgba(8, 12, 26, 0.55)',
  shadowEdge: 'rgba(90, 120, 200, 0.16)',
  page: '#f2c94c',
  pageGlow: 'rgba(242, 201, 76, 0.25)',
  exitClosed: '#274b34',
  exitOpen: '#2f9e5f',
  exitSign: '#8ff0b3',
  player: '#39d0c4',
  playerDark: '#1d8a82',
  guardCalm: '#e5534b',
  guardAlert: '#ff2e1f',
  coneCalm: 'rgba(242, 201, 76, 0.13)',
  coneSuspicious: 'rgba(242, 140, 40, 0.22)',
  coneChase: 'rgba(255, 46, 31, 0.28)',
  coneEdge: 'rgba(242, 201, 76, 0.35)',
  ping: 'rgba(120, 200, 255, 0.5)',
  hudPanel: 'rgba(10, 13, 18, 0.78)',
  hudText: '#eef1f5',
  hudMuted: '#9aa3b2',
  hudDanger: '#ff6b5e',
  hudGold: '#f2c94c',
  panel: '#141821',
  panelEdge: '#2c3444',
  titleGold: '#f2c94c',
  titleTeal: '#39d0c4',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best (fastest) clear is kept between visits (this browser only). */
export const BEST_KEY = 'shadow-ledger.best-seconds';
