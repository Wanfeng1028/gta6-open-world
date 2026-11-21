// Tuning constants for Palmera Bay. One place for every number the rest of
// the game balances against, so a tweak here retunes the whole city.
export const CFG = {
  worldW: 3400,
  worldH: 2600,
  block: 340, // distance between road centre-lines
  roadW: 96,
  sidewalk: 18,
  viewW: 1280,
  viewH: 720,

  walkSpeed: 235,
  sprintMul: 1.55,
  playerRadius: 13,
  playerHp: 100,

  carAccel: 520,
  carBrake: 900,
  carReverse: 260,
  carMaxSpeed: 620,
  carTurn: 2.9,
  carGrip: 3.2,
  carRadius: 20,

  pedSpeed: 55,
  pedCount: 46,
  trafficCount: 30,
  trafficSpeed: 150,

  wantedMax: 5,
  wantedDecay: 0.045, // stars per second while unseen
  bustRadius: 46,
  copRamDamage: 9,

  bulletSpeed: 780,
  bulletDamage: 34,
  rivalDamage: 16,
  fireRate: 0.16,
  clipSize: 12,
  reloadTime: 1.1,
  punchDamage: 18,
  punchRange: 34,

  moneyStart: 150,
  pickupCash: 40,
  missionReward: [400, 650, 900, 1500, 1200, 3000],
  scoreReward: 3000,

  saveKey: 'palmera-bay-save-v2',
};

export const DISTRICTS = [
  { name: 'Marina', x: 0, y: 2100, w: 1100, h: 500, tint: '#3f7d8c' },
  { name: 'Old Town', x: 0, y: 900, w: 1100, h: 1200, tint: '#8c7a3f' },
  { name: 'Downtown', x: 1100, y: 300, w: 1200, h: 1300, tint: '#4f6f9e' },
  { name: 'The Yards', x: 2300, y: 900, w: 1100, h: 1200, tint: '#7a5a8c' },
  { name: 'North Hills', x: 1100, y: 0, w: 2300, h: 300, tint: '#5a8c5a' },
];

export const CAR_MODELS = [
  { name: 'Pinto', body: '#c94f43', top: 430, len: 52, wid: 26 },
  { name: 'Comet', body: '#3f7dc9', top: 520, len: 56, wid: 26 },
  { name: 'Vagabond', body: '#d8b13a', top: 470, len: 58, wid: 28 },
  { name: 'Sultan', body: '#4fc98c', top: 560, len: 54, wid: 26 },
  { name: 'Hauler', body: '#8c8c96', top: 380, len: 66, wid: 30 },
  { name: 'Stiletto', body: '#c93f8c', top: 640, len: 50, wid: 24 },
];

export const PED_SHIRTS = ['#d85a4a', '#4a8fd8', '#e8c84a', '#5ad88c', '#9a6ad8', '#e8e8e8', '#d88c4a', '#4ad8d0'];
export const PED_SKINS = ['#e8b98c', '#c98c5a', '#8c5a3a', '#f0c8a0', '#6e4426'];

export const PALETTE = {
  grass: '#6fae56',
  grassDark: '#639c4d',
  park: '#57a047',
  sand: '#dcc98c',
  sea: '#2e7fa8',
  seaDeep: '#256a8f',
  road: '#3a3f4a',
  roadEdge: '#565c68',
  sidewalkCol: '#9a938a',
  line: '#e8c84a',
  buildingRoof: ['#7a5a44', '#5a6a7a', '#8a6a8a', '#6a7a5a', '#a08a6a', '#4a5a6a', '#9a7a5a'],
  wall: '#4a4038',
};
