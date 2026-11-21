// Deterministic screenshot staging: ?shot=cover|drive|mission|street builds
// a live scene out of the real game systems, so the screenshots are honest
// renders of the game running — a title screen, a police chase, a job in
// progress, and a street scene.
import { CFG } from './settings.js';
import { addWanted, makeCar, stealCar, toast } from './actors.js';
import { startMission, spawnRivals } from './story.js';

export const SHOT_NAMES = ['cover', 'drive', 'mission', 'street'];

export function stageShot(G, name) {
  const T = G.town;
  const p = G.player;
  G.shotMode = name;
  G.shotFrames = 0;
  if (name === 'cover') {
    G.screen = 'title';
    p.x = T.vRoads[5];
    p.y = T.hRoads[2];
    G.cam.x = p.x; G.cam.y = p.y;
    return;
  }
  G.screen = 'play';
  if (name === 'drive') {
    // A fast car, three stars, cruisers closing in, a timed job on the HUD.
    const car = makeCar(G.dice, T.vRoads[5] + 20, T.hRoads[3] - 100, true, true);
    car.body = '#c93f8c'; car.model = 'Stiletto'; car.top = 640;
    car.parked = true; car.traffic = false;
    G.cars.push(car);
    p.x = car.x; p.y = car.y;
    stealCar(G, car);
    car.speed = 420;
    startMission(G, 4);
    G.mission.step = 1;
    G.mission.timer = 58;
    addWanted(G, 3);
    G.cam.x = p.x; G.cam.y = p.y;
    toast(G, 'Checkpoint 1 of 3 — the cops are on you');
    return;
  }
  if (name === 'mission') {
    // The bank job mid-grab: rivals in the room, two stars, gold marker live.
    const b = T.markers.bank;
    p.x = b.x - 60; p.y = b.y + 40;
    p.hp = CFG.playerHp;
    startMission(G, 3);
    G.mission.step = 1;
    G.mission.grabT = 2.5;
    spawnRivals(G, b.x + 30, b.y - 20, 3);
    addWanted(G, 2);
    G.cam.x = p.x; G.cam.y = p.y;
    return;
  }
  // street: on foot by the safehouse, peds and traffic around, first job up.
  const s = T.markers.safehouse;
  p.x = s.x + 90; p.y = s.y + 30;
  p.hp = CFG.playerHp;
  startMission(G, 0);
  const parked = makeCar(G.dice, s.x + 150, s.y + 10, false, true);
  parked.body = '#3f7dc9'; parked.model = 'Comet';
  G.cars.push(parked);
  G.cam.x = p.x; G.cam.y = p.y;
}
