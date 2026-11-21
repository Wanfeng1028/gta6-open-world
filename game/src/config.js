// Palmera Bay — every tuning number, colour and key binding in one place.
// The world is a fixed 3600 x 2600 pixel city; the renderer scales the camera
// to the window, so no rule below depends on the screen size.

export const WORLD = { width: 3600, height: 2600 };

export const STEP = 1 / 60;

export const SAVE_KEY = 'palmera-bay.save.v1';

export const PLAYER = {
  radius: 14,
  walkSpeed: 175,
  sprintSpeed: 265,
  health: 100,
  punchDamage: 12,
  shootCooldown: 0.22,
  bulletSpeed: 900,
  bulletDamage: 34,
  enterRadius: 46,
};

export const CAR = {
  accel: 520,
  reverseAccel: 320,
  maxSpeed: 560,
  maxReverse: 180,
  brake: 900,
  drag: 0.55,
  steer: 2.6,
  grip: 6.0,
  length: 52,
  width: 26,
};

export const TRAFFIC = { cars: 26, parked: 10, peds: 42, copCars: 6 };

export const WANTED = {
  stealCar: 1,
  shoot: 1,
  killPed: 2,
  killCop: 2,
  decayDelay: 9,
  decayRate: 0.09,
  maxStars: 5,
};

export const MONEY = {
  start: 150,
  sprayCost: 200,
  bustedFine: 250,
  wastedFine: 200,
  pickupCash: 40,
};

export const PALETTE = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d39a',
  water: '#2f7fb8',
  waterDeep: '#256b9e',
  road: '#3c3f46',
  roadEdge: '#2e3138',
  lane: '#e8d44d',
  sidewalk: '#b9b3a4',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7d9bb5', '#b5bfae', '#a9719e', '#5b8c7a'],
  buildingWall: '#8a7f74',
  park: '#5d9b4a',
  tree: '#2f7a3d',
  treeLight: '#4da34f',
  player: '#ffcf3f',
  playerJacket: '#e23b3b',
  cop: '#2b6cb0',
  copCar: '#e8e8e8',
  hudBg: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f4f1e6',
  hudGold: '#ffcf3f',
  mission: '#ffd94d',
  danger: '#ff4d4d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const KEYS = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  sprint: ['ShiftLeft', 'ShiftRight'],
  enter: ['KeyE'],
  shoot: ['Space'],
  reload: ['KeyR'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter', 'Space'],
  mute: ['KeyM'],
  save: ['KeyQ'],
};
