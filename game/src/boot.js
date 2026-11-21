// Boot: builds the world, runs the loop, owns the screens, and wires every
// system together. The canvas is a fixed 1280x720 stage scaled by CSS.
import { CFG } from './settings.js';
import { makeDice, hashSeed, clamp, lerp } from './dice.js';
import { Keys } from './keys.js';
import { Synth } from './sound.js';
import { buildTown } from './town.js';
import {
  makePlayer, spawnPeds, spawnTraffic, nearestCar, stealCar, exitCar,
  updatePlayer, updatePeds, updateTraffic, updateCops, toast,
} from './actors.js';
import { firePlayerShot, punch, updateBullets, updateRivals, updatePickups, updateParticles, scatterPickups } from './fight.js';
import { startMission, updateMission, missionObjective, MISSIONS } from './story.js';
import { drawWorld, drawEntities, drawOffscreenArrow } from './painter.js';
import { drawHUD, drawTitle, drawHelp, drawPause, drawBusted, drawWasted, drawDone, drawMissionCard } from './panel.js';
import { stageShot } from './stage.js';
import { saveGame, loadGame, hasSave, applySave } from './storage.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = CFG.viewW;
canvas.height = CFG.viewH;
const statusEl = document.getElementById('status');

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 7) || 7;
const shot = params.get('shot') || '';

const dice = makeDice(hashSeed(`palmera-${seed}`));
const town = buildTown(dice);
const keys = new Keys(canvas);
const synth = new Synth();

const G = {
  dice, town, keys, synth,
  seed,
  screen: 'title',
  time: 0,
  wanted: 0,
  wantedShown: 0,
  money: CFG.moneyStart,
  player: null,
  peds: [],
  cars: [],
  cops: [],
  rivals: [],
  bullets: [],
  parts: [],
  pickups: [],
  mission: { index: -1, step: 0, timer: 0, active: false, target: null, startedAt: -99 },
  missionsDone: [],
  cam: { x: 1700, y: 1300 },
  toasts: [],
  shake: 0,
  gunshotT: 0,
  stats: { carsStolen: 0, rivalsDown: 0, shotsFired: 0 },
  muted: false,
  hasSave: hasSave(),
  pendingMission: 0,
  shotMode: '',
  shotFrames: 0,
  titleSel: 0,
  statusT: 0,
};

function resetWorld() {
  G.dice = makeDice(hashSeed(`palmera-${seed}`));
  G.town = buildTown(G.dice);
  const s = G.town.markers.safehouse;
  G.player = makePlayer(s.x + 40, s.y + 60);
  G.peds = spawnPeds(G.dice, G.town, CFG.pedCount);
  G.cars = spawnTraffic(G.dice, G.town, CFG.trafficCount);
  G.cops = [];
  G.rivals = [];
  G.bullets = [];
  G.parts = [];
  G.pickups = [];
  G.mission = { index: -1, step: 0, timer: 0, active: false, target: null, startedAt: -99 };
  G.missionsDone = [];
  G.wanted = 0;
  G.wantedShown = 0;
  G.toasts = [];
  G.pendingMission = 0;
  G.stats = { carsStolen: 0, rivalsDown: 0, shotsFired: 0 };
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
  scatterPickups(G);
}

function beginMission(i) {
  if (i < 0 || i >= MISSIONS.length) return;
  startMission(G, i);
  G.mission.startedAt = G.time;
  G.pendingMission = i;
}

function nextUnfinished() {
  for (let i = 0; i < MISSIONS.length; i++) {
    if (!G.missionsDone.includes(MISSIONS[i].id)) return i;
  }
  return -1;
}

function newGame() {
  resetWorld();
  G.screen = 'play';
  beginMission(0);
  synth.ensure();
  synth.startMusic();
  toast(G, 'Welcome to Palmera Bay — Mara has work for you');
}

function continueGame() {
  const data = loadGame();
  resetWorld();
  if (data) {
    const next = applySave(G, data);
    G.pendingMission = next >= MISSIONS.length ? -1 : next;
    G.screen = 'play';
    toast(G, 'Save loaded — welcome back to Palmera Bay');
    if (G.pendingMission >= 0) toast(G, 'Press N for the next job');
  } else {
    newGame();
  }
  synth.ensure();
  synth.startMusic();
}

function respawn(penalty, place) {
  const p = G.player;
  p.money = Math.max(0, p.money - penalty);
  p.hp = CFG.playerHp;
  p.busted = 0;
  p.invuln = 1.5;
  if (p.car) { p.car.driver = null; p.car = null; }
  const s = G.town.markers.safehouse;
  p.x = s.x + 40;
  p.y = s.y + 60;
  G.wanted = 0;
  G.wantedShown = 0;
  G.cops.length = 0;
  G.rivals.length = 0;
  G.bullets.length = 0;
  G.cam.x = p.x;
  G.cam.y = p.y;
  void place;
  G.screen = 'play';
}

resetWorld();
// The title screen shows the city alive behind the menu.
G.player.x = G.town.vRoads[5];
G.player.y = G.town.hRoads[2];
G.cam.x = G.player.x;
G.cam.y = G.player.y;

if (shot) stageShot(G, shot);

function titleItems() {
  return G.hasSave ? ['Continue', 'New Game', 'How to Play'] : ['New Game', 'How to Play'];
}

function titleSelect() {
  const item = titleItems()[G.titleSel];
  synth.click();
  if (item === 'Continue') continueGame();
  else if (item === 'New Game') newGame();
  else if (item === 'How to Play') G.screen = 'help';
}

function handleTitleKeys() {
  const items = titleItems();
  if (keys.hit('ArrowUp') || keys.hit('KeyW')) {
    G.titleSel = (G.titleSel + items.length - 1) % items.length;
    synth.click();
  }
  if (keys.hit('ArrowDown') || keys.hit('KeyS')) {
    G.titleSel = (G.titleSel + 1) % items.length;
    synth.click();
  }
  if (keys.hit('Enter') || keys.mouse.clicked) titleSelect();
}

function handlePlayKeys() {
  const p = G.player;
  if (keys.hit('Escape') || keys.hit('KeyP')) { G.screen = 'pause'; synth.click(); return; }
  if (keys.hit('KeyM')) {
    G.muted = !G.muted;
    synth.setMuted(G.muted);
    toast(G, G.muted ? 'Sound muted' : 'Sound on');
  }
  if (keys.hit('KeyQ')) {
    toast(G, saveGame(G) ? 'Game saved' : 'Save failed — storage unavailable');
  }
  if (keys.hit('KeyN') && !G.mission.active) {
    const next = G.mission.index >= 0 && !G.missionsDone.includes(MISSIONS[G.mission.index].id)
      ? G.mission.index
      : nextUnfinished();
    if (next >= 0) beginMission(next);
    else toast(G, 'All jobs done — Palmera Bay is yours');
  }
  if (keys.hit('KeyE')) {
    if (p.car) exitCar(G);
    else {
      const car = nearestCar(G, p.x, p.y, 56);
      if (car) stealCar(G, car);
    }
  }
  if (keys.hit('KeyR') && p.ammo < CFG.clipSize && p.reloading <= 0) {
    p.reloading = CFG.reloadTime;
    synth.click();
  }
  if (keys.hit('Space')) punch(G);
  if (keys.mouse.down && !p.car) firePlayerShot(G);
}

function update(dt) {
  G.time += dt;
  for (const t of G.toasts) t.t -= dt;
  G.toasts = G.toasts.filter((t) => t.t > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);

  if (G.screen === 'title' || G.screen === 'help') {
    // The city idles behind the menu.
    updatePeds(G, dt);
    updateTraffic(G, dt);
    updateParticles(G, dt);
    G.cam.x = G.player.x + Math.sin(G.time * 0.05) * 120;
    G.cam.y = G.player.y + Math.cos(G.time * 0.04) * 80;
    return;
  }
  if (G.screen !== 'play') return;

  updatePlayer(G, dt, keys);
  updatePeds(G, dt);
  updateTraffic(G, dt);
  updateCops(G, dt);
  updateRivals(G, dt);
  updateBullets(G, dt);
  updatePickups(G, dt);
  updateParticles(G, dt);
  updateMission(G, dt);

  // Camera follows the player with a little look-ahead.
  const p = G.player;
  const look = p.car ? 60 : 0;
  const tx = p.x + Math.cos(p.angle) * look;
  const ty = p.y + Math.sin(p.angle) * look;
  G.cam.x = lerp(G.cam.x, tx, Math.min(1, dt * 5));
  G.cam.y = lerp(G.cam.y, ty, Math.min(1, dt * 5));
  G.cam.x = clamp(G.cam.x, CFG.viewW / 2, G.town.W - CFG.viewW / 2);
  G.cam.y = clamp(G.cam.y, CFG.viewH / 2, G.town.H - CFG.viewH / 2);

  if (p.hp <= 0 && G.screen === 'play') {
    G.screen = 'wasted';
    G.player.money = Math.max(0, G.player.money - 150);
    synth.fail();
  }

  G.statusT -= dt;
  if (G.statusT <= 0) {
    G.statusT = 2;
    statusEl.textContent = `Palmera Bay. ${missionObjective(G)}. Cash $${p.money}. Wanted ${G.wantedShown} stars.`;
  }
}

function render() {
  ctx.clearRect(0, 0, CFG.viewW, CFG.viewH);
  const shx = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  const shy = G.shake > 0 ? (Math.random() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(CFG.viewW / 2 - G.cam.x + shx, CFG.viewH / 2 - G.cam.y + shy);
  drawWorld(ctx, G, G.cam);
  drawEntities(ctx, G);
  ctx.restore();
  if (G.screen === 'play' || G.screen === 'pause') {
    drawOffscreenArrow(ctx, G);
    drawHUD(ctx, G);
    drawMissionCard(ctx, G);
  }
  if (G.screen === 'title') drawTitle(ctx, G, G.titleSel);
  if (G.screen === 'help') drawHelp(ctx, G);
  if (G.screen === 'pause') drawPause(ctx, G);
  if (G.screen === 'busted') drawBusted(ctx, G);
  if (G.screen === 'wasted') drawWasted(ctx, G);
  if (G.screen === 'done') drawDone(ctx, G);
}

let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  if (G.screen === 'title') handleTitleKeys();
  else if (G.screen === 'help') {
    if (keys.hit('Escape') || keys.hit('Enter')) { G.screen = 'title'; synth.click(); }
  } else if (G.screen === 'play') handlePlayKeys();
  else if (G.screen === 'pause') {
    if (keys.hit('Escape') || keys.hit('KeyP')) { G.screen = 'play'; synth.click(); }
    if (keys.hit('KeyQ')) toast(G, saveGame(G) ? 'Game saved' : 'Save failed');
    if (keys.hit('KeyM')) { G.muted = !G.muted; synth.setMuted(G.muted); }
  } else if (G.screen === 'busted') {
    if (keys.hit('Enter')) { respawn(200, 'station'); synth.click(); }
  } else if (G.screen === 'wasted') {
    if (keys.hit('Enter')) { respawn(0, 'hospital'); synth.click(); }
  } else if (G.screen === 'done') {
    if (keys.hit('Enter')) { G.screen = 'play'; synth.click(); }
  }
  update(dt);
  render();
  if (G.shotMode) {
    G.shotFrames++;
    if (G.shotFrames > 90) window.__shotReady = true;
  }
  keys.endFrame();
  requestAnimationFrame(frame);
}

// First interaction unlocks audio (browsers require a gesture).
window.addEventListener('pointerdown', () => { synth.ensure(); }, { once: true });
window.addEventListener('keydown', () => { synth.ensure(); }, { once: true });

// Test / automation hook: state for the screenshot driver and play-tests.
window.__palmera = {
  state() {
    const p = G.player;
    return {
      screen: G.screen,
      wanted: G.wantedShown,
      money: p.money,
      health: Math.ceil(p.hp),
      inCar: !!p.car,
      mission: G.mission.active ? MISSIONS[G.mission.index].id : (G.missionsDone.length ? 'done' : 'none'),
      objective: missionObjective(G),
      cars: G.cars.length,
      peds: G.peds.filter((x) => x.state !== 'dead').length,
      cops: G.cops.length,
      rivals: G.rivals.filter((r) => r.hp > 0).length,
      x: Math.round(p.x),
      y: Math.round(p.y),
    };
  },
  warp(x, y) {
    G.player.x = x; G.player.y = y;
    if (G.player.car) { G.player.car.x = x; G.player.car.y = y; G.player.car.speed = 0; }
    G.cam.x = x; G.cam.y = y;
  },
  setWanted(n) { G.wanted = n; G.wantedShown = n; },
  start(i) { beginMission(i); },
  give(n) { G.player.money += n; },
  save() { return saveGame(G); },
  screen() { return G.screen; },
  debug() {
    return {
      cam: { x: Math.round(G.cam.x), y: Math.round(G.cam.y) },
      rivals: G.rivals.map((r) => ({ x: Math.round(r.x), y: Math.round(r.y), hp: r.hp })),
      cops: G.cops.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y) })),
      target: G.mission.target ? { x: G.mission.target.x, y: G.mission.target.y } : null,
      missionIndex: G.mission.index,
      missionStep: G.mission.step,
      missionActive: G.mission.active,
      missionsDone: [...G.missionsDone],
      cars: G.cars.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), parked: c.parked, traffic: c.traffic, model: c.model })),
      pickups: G.pickups.length,
      wanted: G.wanted,
    };
  },
};

requestAnimationFrame(frame);
