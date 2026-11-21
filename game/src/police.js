// The Palmera Bay Police Department: the wanted level, the cruisers that
// chase it, and the foot cops who try to make an arrest. Heat rises with
// crime and cools when the player stays out of sight.

import { WANTED, WORLD } from './config.js';
import { nearestRoadPoint } from './city.js';

function starsFor(heat) {
  if (heat < 1) return 0;
  if (heat < 3) return 1;
  if (heat < 6) return 2;
  if (heat < 10) return 3;
  if (heat < 15) return 4;
  return 5;
}

export function createPolice() {
  let heat = 0;
  let unseenTimer = 0;
  let spawnTimer = 0;
  let sirenOn = false;

  function addHeat(amount, game) {
    heat = Math.min(20, heat + amount);
    game.wanted = starsFor(heat);
    unseenTimer = 0;
  }

  function spawnCruiser(game) {
    const p = game.player;
    const angle = Math.random() * Math.PI * 2;
    const x = Math.max(80, Math.min(WORLD.width - 80, p.x + Math.cos(angle) * 900));
    const y = Math.max(80, Math.min(WORLD.height - 80, p.y + Math.sin(angle) * 900));
    const road = nearestRoadPoint(x, y);
    const car = game.addTrafficCar(road.x, road.y, 'cop');
    if (car) {
      car.police = true;
      car.speed = 0;
    }
    return car;
  }

  function spawnFootCop(game) {
    const p = game.player;
    const angle = Math.random() * Math.PI * 2;
    const cop = {
      x: Math.max(30, Math.min(WORLD.width - 30, p.x + Math.cos(angle) * 420)),
      y: Math.max(30, Math.min(WORLD.height - 30, p.y + Math.sin(angle) * 420)),
      radius: 14,
      speed: 150 + game.wanted * 8,
      health: 60,
      kind: 'cop',
      shootCooldown: 0,
      color: '#2b6cb0',
    };
    game.cops.push(cop);
    return cop;
  }

  return {
    get heat() {
      return heat;
    },
    setHeat(value, game) {
      heat = value;
      game.wanted = starsFor(heat);
    },
    addHeat,
    update(dt, game) {
      const wanted = game.wanted;
      sirenOn = wanted > 0;
      // Heat cools only while no cop can see the player.
      const player = game.player;
      let seen = false;
      for (const car of game.cars) {
        if (car.police && Math.hypot(car.x - player.x, car.y - player.y) < 520) seen = true;
      }
      for (const cop of game.cops) {
        if (Math.hypot(cop.x - player.x, cop.y - player.y) < 420) seen = true;
      }
      if (wanted > 0 && !seen) {
        unseenTimer += dt;
        if (unseenTimer > WANTED.decayDelay) {
          heat = Math.max(0, heat - WANTED.decayRate * dt * 10);
          const next = starsFor(heat);
          if (next !== game.wanted) game.wanted = next;
        }
      } else {
        unseenTimer = 0;
      }

      // Keep the right number of cruisers on the street.
      const wantCruisers = wanted === 0 ? 0 : Math.min(1 + wanted, 6);
      const cruisers = game.cars.filter((c) => c.police);
      spawnTimer -= dt;
      if (cruisers.length < wantCruisers && spawnTimer <= 0) {
        spawnCruiser(game);
        spawnTimer = 1.2;
      }
      // Foot cops join the chase from 2 stars up.
      if (wanted >= 2 && game.cops.length < wanted && spawnTimer <= 0) {
        spawnFootCop(game);
        spawnTimer = 2.5;
      }
      if (wanted === 0) {
        for (const car of cruisers) car.leaving = true;
        game.cops.length = 0;
      }
    },
    sirenOn() {
      return sirenOn;
    },
  };
}
