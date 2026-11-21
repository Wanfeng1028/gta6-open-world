// The screenshot scenes behind ?shot=cover|drive|mission|street. Each one
// plays the real rules forward from a fresh world for a few seconds, steered
// by a tiny autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { PLACES } from './city.js';
import { STEP } from './config.js';

const SAMPLE_SECONDS = 1 / 30;

function fakeInput(dir, shooting) {
  return {
    direction() {
      return dir;
    },
    sprint() {
      return false;
    },
    shooting() {
      return !!shooting;
    },
  };
}

function putPlayerInCar(game, car) {
  car.parked = false;
  car.driver = 'player';
  car.speed = 0;
  const p = game.player;
  p.inCar = true;
  p.car = car;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
}

function nearestParkedCar(game, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const car of game.cars) {
    if (!car.parked || car.police) continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      best = car;
      bestD = d;
    }
  }
  return best;
}

/** A fresh car placed exactly on a road, for scenes that must start driving. */
function placeCarOnRoad(game, x, y, angle, kind, color) {
  const car = {
    id: 9000 + game.cars.length,
    x,
    y,
    angle,
    speed: 0,
    targetSpeed: 0,
    kind,
    color,
    police: false,
    parked: true,
    driver: null,
    vertical: Math.abs(angle) > 1,
    dir: 1,
    health: 100,
    leaving: false,
    marked: false,
    turnCooldown: 0,
  };
  game.cars.push(car);
  return car;
}

/** Steer a car toward (tx, ty): forward always, left/right by angle error. */
function driveToward(game, tx, ty) {
  const car = game.player.car;
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = diff > 0.12 ? 1 : diff < -0.12 ? -1 : 0;
  return { x: steer, y: -1 };
}

/** Follow road waypoints in order, moving to the next when close. */
function driveRoute(game, waypoints) {
  let wp = 0;
  return () => {
    const target = waypoints[Math.min(wp, waypoints.length - 1)];
    const car = game.player.car;
    if (Math.hypot(target.x - car.x, target.y - car.y) < 90 && wp < waypoints.length - 1) wp += 1;
    return fakeInput(driveToward(game, waypoints[Math.min(wp, waypoints.length - 1)].x, waypoints[Math.min(wp, waypoints.length - 1)].y), false);
  };
}

function stepFor(game, seconds, inputFn, aimFn) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const input = inputFn(i);
    const aim = aimFn ? aimFn(i) : game.player.aimAngle;
    game.step(STEP, input, aim, { enter: false });
    if (game.busted || game.wasted) break;
  }
}

function nearestRivalAngle(game) {
  let best = null;
  let bestD = Infinity;
  for (const rival of game.rivals) {
    const d = Math.hypot(rival.x - game.player.x, rival.y - game.player.y);
    if (d < bestD) {
      best = rival;
      bestD = d;
    }
  }
  if (!best) return game.player.aimAngle;
  return Math.atan2(best.y - game.player.y, best.x - game.player.x);
}

export function stageShot(name, game) {
  game.money = 1250;
  if (name === 'drive') {
    // Cruising downtown in a sports car, traffic all around: start on
    // avenue 1500 heading north so the run stays on the road.
    const car = placeCarOnRoad(game, 1500, 1560, -Math.PI / 2, 'sports', '#d94f3d');
    game.player.x = car.x + 30;
    game.player.y = car.y;
    putPlayerInCar(game, car);
    stepFor(game, 3.5, () => fakeInput(driveToward(game, 1500, 300), false));
    return 'play';
  }
  if (name === 'mission') {
    // The Street Sweep shootout: Milo on foot in the Warehouse Yard,
    // Vipers shooting back, the objective live on the HUD.
    game.missions.start(4, game);
    game.player.x = PLACES.warehouse.x + 170;
    game.player.y = PLACES.warehouse.y + 60;
    stepFor(game, 1.4, () => fakeInput({ x: -1, y: -1 }, false));
    stepFor(game, 2.6, () => fakeInput({ x: 0, y: 0 }, true), () => nearestRivalAngle(game));
    return 'play';
  }
  if (name === 'street') {
    // On foot in Palm Park: pedestrians, traffic on the avenues, the beach
    // at the bottom of the minimap.
    game.player.x = PLACES.park.x - 120;
    game.player.y = PLACES.park.y + 60;
    stepFor(game, 2.0, () => fakeInput({ x: 0, y: -1 }, false));
    return 'play';
  }
  // Cover: the Palmera Score escape — 3 wanted stars, cruisers closing in,
  // the safehouse marker on the HUD and the minimap.
  game.missions.start(5, game);
  game.player.x = PLACES.bank.x + 60;
  game.player.y = PLACES.bank.y + 40;
  stepFor(game, 0.6, () => fakeInput({ x: 0, y: 0 }, false));
  // The vault grab: six seconds holding the spot, heat rising.
  game.police.setHeat(10, game);
  game.player.health = 100;
  stepFor(game, 6.2, () => fakeInput({ x: 0, y: 0 }, false));
  const car = placeCarOnRoad(game, 2040, 1300, Math.PI, 'sports', '#e8c33a');
  game.player.x = car.x + 30;
  game.player.y = car.y;
  putPlayerInCar(game, car);
  game.player.health = 100;
  // West along street 1300, then north up avenue 1500 toward the safehouse —
  // still mid-escape, wanted stars up, cruisers on the tail. The run is cut
  // short while the car is still flying down the street, not pinned.
  stepFor(game, 1.8, driveRoute(game, [
    { x: 1500, y: 1300 },
    { x: PLACES.safehouse.x, y: PLACES.safehouse.y },
  ]));
  game.player.hurtTimer = 0;
  return 'play';
}

export { SAMPLE_SECONDS };
