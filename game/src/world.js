// The simulation: the player on foot and in cars, traffic, pedestrians,
// foot cops, rivals, bullets, pickups, the spray shop, and the bust/waste
// rules. Rendering and the mission list live elsewhere; this file only
// moves things and decides what happened.

import { WORLD, PLAYER, CAR, TRAFFIC, WANTED, MONEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { buildCity, isOnRoad, isOnSidewalk, nearestRoadPoint, resolveSolid, pushOutOfSolid, hitsSolid, PLACES, AVENUES, STREETS } from './city.js';
import { createCombat } from './combat.js';
import { createPolice } from './police.js';
import { createMissionRunner, MISSIONS } from './missions.js';

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8c33a', '#7a4fd9', '#3da66b', '#d9d9d9', '#e07b39', '#4fb3c9'];
const PED_COLORS = ['#e8b04b', '#7fb069', '#c97b9e', '#6b8fc9', '#d9d9d9', '#b07a4f'];
const PED_NAMES = ['Ana', 'Marco', 'Lena', 'Tomas', 'Priya', 'Sam', 'Nia', 'Omar', 'Ruth', 'Kai'];

let nextCarId = 1;
let nextPedId = 1;

function carKinds() {
  return ['sedan', 'hatch', 'pickup', 'taxi', 'sports'];
}

export function createGame(seed, save) {
  const random = createRandom(seed);
  const city = buildCity(random);
  const combat = createCombat();
  const police = createPolice();

  const game = {
    seed,
    city,
    combat,
    police,
    save,
    time: 0,
    wanted: 0,
    money: save ? save.money : MONEY.start,
    camera: { x: 1560, y: 390 },
    shake: 0,
    banner: null,
    bannerTimer: 0,
    prompt: '',
    sprayTimer: 0,
    bustTimer: 0,
    busted: false,
    wasted: false,
    storyDone: save ? save.storyDone : false,
    nextMissionAt: 0,
    player: null,
    cars: [],
    peds: [],
    cops: [],
    rivals: [],
    pickups: [],
    skids: [],
    markedCar: null,
    muted: false,
  };

  game.player = {
    x: 1560,
    y: 390,
    angle: Math.PI / 2,
    aimAngle: 0,
    radius: PLAYER.radius,
    health: PLAYER.health,
    inCar: false,
    car: null,
    shootCooldown: 0,
    hurtTimer: 0,
    speed: 0,
    moving: false,
  };

  function showBanner(text, sub) {
    game.banner = { text, sub: sub || '' };
    game.bannerTimer = 3.2;
  }

  const missions = createMissionRunner({
    onMissionStart(m) {
      showBanner(m.title, `${m.giver}: ${m.briefing}`);
    },
    onObjective() {},
    onMissionComplete(m) {
      game.money += m.reward;
      if (!game.save.missionsDone.includes(m.id)) game.save.missionsDone.push(m.id);
      game.save.bestCash = Math.max(game.save.bestCash, game.money);
      combat.floater(game.player.x, game.player.y - 30, `+$${m.reward}`, '#ffd94d');
      showBanner('Job Complete', `${m.title} — $${m.reward} earned`);
      game.audio.missionDone();
      if (game.save.missionsDone.length >= MISSIONS.length) {
        game.storyDone = true;
        game.save.storyDone = true;
        showBanner('The Palmera Score — Done', 'Story complete. Palmera Bay is yours.');
      } else {
        game.nextMissionAt = game.time + 6;
      }
    },
    onMissionFailed(m) {
      showBanner('Job Failed', `${m.title} — talk to Rico to try again`);
      game.nextMissionAt = game.time + 8;
    },
  });
  missions.setGame(game);
  game.missions = missions;

  function spawnTrafficCar(x, y, kind) {
    const vertical = random.chance(0.5);
    const line = vertical ? nearestRoadPoint(x, y).x : nearestRoadPoint(x, y).y;
    const dir = random.chance(0.5) ? 1 : -1;
    const car = {
      id: nextCarId,
      x: vertical ? line + dir * 28 : x,
      y: vertical ? y : line + dir * 28,
      angle: vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      speed: random.range(120, 190),
      targetSpeed: random.range(130, 200),
      kind: kind || random.pick(carKinds()),
      color: kind === 'cop' ? '#e8e8e8' : random.pick(CAR_COLORS),
      police: kind === 'cop',
      parked: false,
      driver: 'ped',
      vertical,
      dir,
      health: 100,
      leaving: false,
      marked: false,
      turnCooldown: 0,
    };
    nextCarId += 1;
    game.cars.push(car);
    return car;
  }

  game.addTrafficCar = spawnTrafficCar;

  function spawnParkedCar(spot) {
    const car = {
      id: nextCarId,
      x: spot.x,
      y: spot.y,
      angle: spot.angle,
      speed: 0,
      targetSpeed: 0,
      kind: spot.kind,
      color: random.pick(CAR_COLORS),
      police: false,
      parked: true,
      driver: null,
      vertical: Math.abs(spot.angle) > 1,
      dir: 1,
      health: 100,
      leaving: false,
      marked: false,
      turnCooldown: 0,
    };
    nextCarId += 1;
    game.cars.push(car);
    return car;
  }

  function spawnPed(x, y) {
    const ped = {
      id: nextPedId,
      x,
      y,
      angle: random.range(0, Math.PI * 2),
      radius: 12,
      speed: random.range(42, 68),
      health: 40,
      kind: 'ped',
      name: random.pick(PED_NAMES),
      color: random.pick(PED_COLORS),
      state: 'walk',
      stateTimer: random.range(1, 4),
      fleeTimer: 0,
      downTimer: 0,
    };
    nextPedId += 1;
    game.peds.push(ped);
    return ped;
  }

  function spawnPickup(kind, x, y) {
    game.pickups.push({ kind, x, y, timer: 0, bob: random.range(0, 6) });
  }

  // --- initial population ---
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    spawnTrafficCar(avenue + random.range(-200, 200), street + random.range(-200, 200));
  }
  for (const spot of city.parking.slice(0, TRAFFIC.parked)) spawnParkedCar(spot);
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    spawnPed(avenue + random.range(-70, 70), street + random.range(-70, 70));
  }
  for (let i = 0; i < 8; i += 1) {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    spawnPickup('cash', avenue + random.range(-60, 60), street + random.range(-60, 60));
  }
  for (let i = 0; i < 4; i += 1) {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    spawnPickup('health', avenue + random.range(-60, 60), street + random.range(-60, 60));
  }

  game.spawnMarkedCar = function (placeKey, missionId) {
    const place = PLACES[placeKey];
    const road = nearestRoadPoint(place.x, place.y);
    const car = {
      id: nextCarId,
      x: road.x + 40,
      y: road.y + 40,
      angle: 0,
      speed: 0,
      targetSpeed: 0,
      kind: missionId === 'repo' ? 'sports' : 'coupe',
      color: missionId === 'repo' ? '#e8c33a' : '#d94f3d',
      police: false,
      parked: true,
      driver: null,
      vertical: false,
      dir: 1,
      health: 100,
      leaving: false,
      marked: true,
      missionId,
      turnCooldown: 0,
    };
    nextCarId += 1;
    game.cars.push(car);
    game.markedCar = car;
    return car.id;
  };

  game.clearMarkedCar = function () {
    if (!game.markedCar) return;
    if (game.player.car === game.markedCar) exitCar();
    game.cars = game.cars.filter((c) => c !== game.markedCar);
    game.markedCar = null;
  };

  game.spawnRivals = function (placeKey, count) {
    const place = PLACES[placeKey];
    for (let i = 0; i < count; i += 1) {
      game.rivals.push({
        x: place.x + random.range(-160, 160),
        y: place.y + random.range(-160, 160),
        radius: 14,
        speed: 120,
        health: 70,
        kind: 'rival',
        color: '#5b2d8e',
        shootCooldown: random.range(0.4, 1.2),
        state: 'fight',
      });
    }
  };

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of game.cars) {
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) {
        best = car;
        bestD = d;
      }
    }
    return best;
  }

  function enterCar(car) {
    const p = game.player;
    if (car.driver === 'ped') {
      // Carjack: the driver bails out and runs.
      const driver = spawnPed(car.x + 30, car.y + 30);
      driver.fleeTimer = 4;
      car.driver = null;
      police.addHeat(WANTED.stealCar, game);
      game.save.carsStolen += 1;
      combat.floater(p.x, p.y - 26, 'Carjacked!', '#ff9d4d');
    }
    if (car.marked) {
      const m = missions.current();
      if (m && m.id === 'heat') police.setHeat(3, game);
    }
    car.parked = false;
    car.driver = 'player';
    p.inCar = true;
    p.car = car;
    p.x = car.x;
    p.y = car.y;
    missions.notifyStolen(car);
    game.audio.click();
  }

  function exitCar() {
    const p = game.player;
    if (!p.car) return;
    const car = p.car;
    car.driver = null;
    car.parked = true;
    car.speed = 0;
    p.inCar = false;
    p.car = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    resolveSolid(city, p);
  }

  game.enterOrExitCar = function () {
    if (game.player.inCar) {
      exitCar();
      return;
    }
    const car = nearestCar(game.player.x, game.player.y, PLAYER.enterRadius);
    if (car) enterCar(car);
  };

  game.startNextMission = function () {
    const next = MISSIONS.findIndex((m) => !game.save.missionsDone.includes(m.id));
    if (next >= 0) missions.start(next, game);
  };

  game.respawn = function (placeKey) {
    const place = PLACES[placeKey];
    const p = game.player;
    if (p.car) {
      p.car.driver = null;
      p.car.parked = true;
      p.car.speed = 0;
      p.car = null;
    }
    p.inCar = false;
    p.x = place.x + 40;
    p.y = place.y + 40;
    p.health = PLAYER.health;
    p.hurtTimer = 0;
    game.wanted = 0;
    police.setHeat(0, game);
    game.cops.length = 0;
    game.bustTimer = 0;
    game.busted = false;
    game.wasted = false;
    game.camera.x = p.x;
    game.camera.y = p.y;
  };

  // --- per-frame updates ---

  function stepPlayerOnFoot(dt, input, aimAngle) {
    const p = game.player;
    const dir = input.direction();
    const speed = input.sprint() ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
    p.moving = dir.x !== 0 || dir.y !== 0;
    p.speed = p.moving ? speed : 0;
    p.x += dir.x * speed * dt;
    p.y += dir.y * speed * dt;
    if (p.moving) p.angle = Math.atan2(dir.y, dir.x);
    p.aimAngle = aimAngle;
    resolveSolid(city, p);
    p.shootCooldown -= dt;
    p.hurtTimer -= dt;
    if (input.shooting() && p.shootCooldown <= 0) {
      p.shootCooldown = PLAYER.shootCooldown;
      combat.fire(p.x + Math.cos(aimAngle) * 20, p.y + Math.sin(aimAngle) * 20, aimAngle, PLAYER.bulletSpeed, PLAYER.bulletDamage, true);
      game.audio.gunshot();
      if (game.wanted < 1) police.addHeat(WANTED.shoot, game);
    }
    if (p.health < PLAYER.health && game.wanted === 0 && p.hurtTimer <= 0) {
      p.health = Math.min(PLAYER.health, p.health + 2.5 * dt);
    }
  }

  function stepPlayerCar(dt, input) {
    const p = game.player;
    const car = p.car;
    const dir = input.direction();
    const forward = { x: Math.cos(car.angle), y: Math.sin(car.angle) };
    const speedAlong = car.speed;
    let accel = 0;
    if (dir.y < 0) accel = CAR.accel;
    else if (dir.y > 0) accel = -CAR.reverseAccel;
    if (input.shooting()) accel = -Math.sign(speedAlong) * CAR.brake;
    car.speed += accel * dt;
    car.speed -= car.speed * CAR.drag * dt;
    if (car.speed > CAR.maxSpeed) car.speed = CAR.maxSpeed;
    if (car.speed < -CAR.maxReverse) car.speed = -CAR.maxReverse;
    if (Math.abs(car.speed) < 4 && accel === 0) car.speed = 0;
    const steerAmount = dir.x * CAR.steer * Math.min(1, Math.abs(car.speed) / 160) * (car.speed >= 0 ? 1 : -1);
    car.angle += steerAmount * dt * (Math.abs(car.speed) > 10 ? 1 : 0);
    const prevX = car.x;
    const prevY = car.y;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Buildings: push the nose, centre and tail out of any wall they entered,
    // so a shove from another car can never leave the car inside a building.
    let hitWall = false;
    for (const off of [18, 0, -18]) {
      const px = car.x + forward.x * off;
      const py = car.y + forward.y * off;
      const fixed = pushOutOfSolid(city, px, py, 13);
      if (fixed.x !== px || fixed.y !== py) {
        car.x += fixed.x - px;
        car.y += fixed.y - py;
        hitWall = true;
      }
    }
    if (hitWall) {
      if (Math.abs(car.speed) > 240) {
        game.audio.crash();
        combat.sparks(car.x, car.y);
        game.shake = Math.min(10, game.shake + 5);
        car.health -= 8;
      }
      car.speed *= -0.25;
    }
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    // Skid marks on hard turns.
    if (Math.abs(steerAmount) > 1.4 && Math.abs(car.speed) > 260) {
      game.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 4 });
      if (game.skids.length > 220) game.skids.shift();
    }
    for (const s of game.skids) s.life -= dt;
    game.skids = game.skids.filter((s) => s.life > 0);
    if (car.health <= 0) {
      combat.explode(car.x, car.y);
      game.audio.crash();
      game.cars = game.cars.filter((c) => c !== car);
      p.health -= 40;
      p.hurtTimer = 2;
      exitCar();
      game.shake = 12;
    }
  }

  function stepTraffic(dt) {
    for (const car of game.cars) {
      if (car.driver === 'player' || car.parked) continue;
      // Police cruisers steer themselves in stepPoliceCar; the traffic
      // lane logic below must not move them a second time.
      if (car.police) {
        stepPoliceCar(dt, car);
        continue;
      }
      car.turnCooldown -= dt;
      // Slow down for the car ahead on the same road.
      let blocked = false;
      for (const other of game.cars) {
        if (other === car || other.parked) continue;
        const dx = other.x - car.x;
        const dy = other.y - car.y;
        const ahead = car.vertical ? Math.abs(dx) < 40 && dy * car.dir > 0 && dy * car.dir < 90
          : Math.abs(dy) < 40 && dx * car.dir > 0 && dx * car.dir < 90;
        if (ahead) {
          blocked = true;
          break;
        }
      }
      const target = car.leaving ? car.targetSpeed : blocked ? 0 : car.targetSpeed;
      car.speed += Math.max(-260 * dt, Math.min(260 * dt, target - car.speed));
      const stepDist = car.speed * dt;
      if (car.vertical) car.y += car.dir * stepDist;
      else car.x += car.dir * stepDist;
      // Turn at intersections sometimes.
      const nearStreet = STREETS.some((s) => Math.abs(car.y - s) < 8 && car.vertical);
      const nearAvenue = AVENUES.some((a) => Math.abs(car.x - a) < 8 && !car.vertical);
      if ((nearStreet || nearAvenue) && car.turnCooldown <= 0 && Math.random() < 0.3) {
        car.vertical = !car.vertical;
        const road = nearestRoadPoint(car.x, car.y);
        if (car.vertical) {
          car.x = road.x + car.dir * 28;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          car.y = road.y + car.dir * 28;
          car.angle = car.dir > 0 ? 0 : Math.PI;
        }
        car.turnCooldown = 2;
      }
      // Wrap around the far edge so traffic never runs dry.
      if (car.x < -80) car.x = WORLD.width + 60;
      if (car.x > WORLD.width + 80) car.x = -60;
      if (car.y < -80) car.y = WORLD.height + 60;
      if (car.y > WORLD.height + 80) car.y = -60;
    }
    // Keep the streets full: replace cars that left the map edge or were lost.
    const moving = game.cars.filter((c) => !c.parked && c.driver !== 'player').length;
    if (moving < TRAFFIC.cars) {
      const avenue = random.pick(AVENUES);
      const street = random.pick(STREETS);
      spawnTrafficCar(avenue, street + random.range(-300, 300));
    }
  }

  function stepPoliceCar(dt, car) {
    const p = game.player;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    const dist = Math.hypot(dx, dy);
    if (game.wanted === 0) {
      car.speed = Math.max(0, car.speed - 200 * dt);
      return;
    }
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
    const target = Math.min(430 + game.wanted * 30, 560);
    car.speed += Math.max(-500 * dt, Math.min(500 * dt, target - car.speed));
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Cruisers steer freely, so keep them out of the buildings too.
    const fixed = pushOutOfSolid(game.city, car.x, car.y, 20);
    car.x = fixed.x;
    car.y = fixed.y;
    // Ram the player: shove the car sideways and scrub some speed, so a
    // determined driver can still pull away instead of being pinned.
    if (dist < 46) {
      if (p.inCar && p.car) {
        const push = 8;
        p.car.x += (dx / dist) * push;
        p.car.y += (dy / dist) * push;
        p.car.speed *= 0.85;
        game.shake = Math.min(10, game.shake + 4);
        game.audio.crash();
      } else {
        p.health -= 30 * dt;
        p.hurtTimer = 1;
      }
    }
  }

  function stepPeds(dt) {
    const p = game.player;
    for (const ped of game.peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.fleeTimer = 4;
        }
        continue;
      }
      ped.stateTimer -= dt;
      ped.fleeTimer -= dt;
      const nearGun = game.combat.bullets.some((b) => Math.hypot(b.x - ped.x, b.y - ped.y) < 160);
      const nearFastCar = game.cars.some((c) => !c.parked && Math.abs(c.speed) > 200 && Math.hypot(c.x - ped.x, c.y - ped.y) < 90);
      if ((nearGun || nearFastCar) && ped.fleeTimer <= 0) {
        ped.state = 'flee';
        ped.fleeTimer = 3;
      }
      if (ped.state === 'flee') {
        const dx = ped.x - p.x;
        const dy = ped.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * ped.speed * 1.7 * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * 1.7 * dt;
        if (ped.fleeTimer <= 0) ped.state = 'walk';
      } else {
        if (ped.stateTimer <= 0) {
          ped.stateTimer = random.range(1.5, 5);
          if (isOnSidewalk(ped.x, ped.y) || isOnRoad(ped.x, ped.y)) {
            ped.angle = random.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
          } else {
            ped.angle = random.range(0, Math.PI * 2);
          }
        }
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
      }
      resolveSolid(city, ped);
    }
    game.peds = game.peds.filter((ped) => ped.health > 0 || ped.state === 'down');
    if (game.peds.length < 30) {
      const avenue = random.pick(AVENUES);
      const street = random.pick(STREETS);
      spawnPed(avenue + random.range(-70, 70), street + random.range(-70, 70));
    }
  }

  function stepCops(dt) {
    const p = game.player;
    for (const cop of game.cops) {
      const dx = p.x - cop.x;
      const dy = p.y - cop.y;
      const dist = Math.hypot(dx, dy) || 1;
      cop.shootCooldown -= dt;
      if (p.inCar) {
        // On foot they chase; a car outruns them, so they hold position and radio in.
        if (dist > 500) continue;
      }
      cop.x += (dx / dist) * cop.speed * dt;
      cop.y += (dy / dist) * cop.speed * dt;
      resolveSolid(city, cop);
      if (dist < 380 && cop.shootCooldown <= 0 && !p.inCar) {
        cop.shootCooldown = 1.1;
        const aim = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.24;
        combat.fire(cop.x, cop.y, aim, 620, 9, false);
        game.audio.gunshot();
      }
      if (dist < 26 && !p.inCar && game.wanted > 0) {
        game.bustTimer += dt;
        if (game.bustTimer > 0.8) {
          game.busted = true;
          game.audio.busted();
        }
      }
    }
    game.cops = game.cops.filter((c) => c.health > 0);
    // Boxed in while driving: nearly stopped, a cruiser glued to the door.
    if (p.inCar && game.wanted > 0 && Math.abs(p.car.speed) < 12) {
      const near = game.cars.some((c) => c.police && Math.hypot(c.x - p.x, c.y - p.y) < 70);
      if (near) {
        game.bustTimer += dt;
        if (game.bustTimer > 2.5) {
          game.busted = true;
          game.audio.busted();
        }
      } else {
        game.bustTimer = Math.max(0, game.bustTimer - dt);
      }
    } else if (!game.cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 26)) {
      game.bustTimer = Math.max(0, game.bustTimer - dt);
    }
  }

  function stepRivals(dt) {
    const p = game.player;
    for (const rival of game.rivals) {
      const dx = p.x - rival.x;
      const dy = p.y - rival.y;
      const dist = Math.hypot(dx, dy) || 1;
      rival.shootCooldown -= dt;
      if (dist > 200) {
        rival.x += (dx / dist) * rival.speed * dt;
        rival.y += (dy / dist) * rival.speed * dt;
      }
      if (dist < 420 && rival.shootCooldown <= 0) {
        rival.shootCooldown = 1.3;
        const aim = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.2;
        combat.fire(rival.x, rival.y, aim, 620, 8, false);
        game.audio.gunshot();
      }
      resolveSolid(city, rival);
    }
    game.rivals = game.rivals.filter((r) => r.health > 0);
  }

  function stepBullets(dt) {
    const p = game.player;
    for (const b of [...combat.bullets]) {
      if (hitsSolid(city, b.x, b.y, 2)) {
        combat.bullets.splice(combat.bullets.indexOf(b), 1);
        combat.sparks(b.x, b.y);
        continue;
      }
      let consumed = false;
      if (!b.friendly) {
        if (Math.hypot(b.x - p.x, b.y - p.y) < p.radius + 4) {
          p.health -= b.damage;
          p.hurtTimer = 2;
          combat.blood(p.x, p.y);
          combat.bullets.splice(combat.bullets.indexOf(b), 1);
          if (p.health <= 0) game.wasted = true;
          continue;
        }
      } else {
        for (const car of game.cars) {
          if (Math.hypot(b.x - car.x, b.y - car.y) < 26) {
            car.health -= b.damage;
            combat.sparks(b.x, b.y);
            combat.bullets.splice(combat.bullets.indexOf(b), 1);
            consumed = true;
            if (car.health <= 0) {
              combat.explode(car.x, car.y);
              game.audio.crash();
              game.shake = 12;
              if (car === p.car) {
                p.health -= 40;
                exitCar();
              }
              if (car.marked) game.markedCar = null;
              game.cars = game.cars.filter((c) => c !== car);
            }
            break;
          }
        }
        if (consumed) continue;
        const targets = [...game.peds, ...game.cops, ...game.rivals];
        for (const t of targets) {
          if (t.state === 'down') continue;
          if (Math.hypot(b.x - t.x, b.y - t.y) < t.radius + 4) {
            t.health -= b.damage;
            combat.blood(t.x, t.y);
            combat.bullets.splice(combat.bullets.indexOf(b), 1);
            consumed = true;
            if (t.health <= 0) {
              if (t.kind === 'cop') police.addHeat(WANTED.killCop, game);
              else if (t.kind === 'rival') missions.notifyKill('rival');
              else police.addHeat(WANTED.killPed, game);
              combat.floater(t.x, t.y - 20, t.kind === 'rival' ? 'Viper down' : 'Down', '#ff6b6b');
            }
            break;
          }
        }
      }
    }
  }

  function stepCarCollisions(dt) {
    const cars = game.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 44 && d > 0.01) {
          const push = (44 - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * push;
          a.y -= ny * push;
          b.x += nx * push;
          b.y += ny * push;
          if (a.driver === 'player' && Math.abs(a.speed) > 200) {
            game.audio.crash();
            combat.sparks(a.x, a.y);
          }
          if (a.driver === 'player') a.speed *= 0.6;
          if (b.driver === 'player') b.speed *= 0.6;
        }
      }
    }
    // The player's car vs pedestrians.
    const p = game.player;
    if (p.inCar && p.car) {
      for (const ped of game.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - p.car.x, ped.y - p.car.y) < 30) {
          ped.state = 'down';
          ped.downTimer = 6;
          ped.health = Math.abs(p.car.speed) > 300 ? 0 : ped.health;
          combat.blood(ped.x, ped.y);
          police.addHeat(ped.health <= 0 ? WANTED.killPed : 1, game);
          p.car.speed *= 0.75;
          game.shake = Math.min(8, game.shake + 3);
        }
      }
    }
  }

  function stepPickups(dt) {
    const p = game.player;
    for (const pickup of game.pickups) {
      pickup.bob += dt;
      pickup.timer -= dt;
      if (Math.hypot(pickup.x - p.x, pickup.y - p.y) < 34) {
        if (pickup.kind === 'cash') {
          game.money += MONEY.pickupCash;
          combat.floater(p.x, p.y - 26, `+$${MONEY.pickupCash}`, '#7CFC9a');
        } else {
          p.health = Math.min(PLAYER.health, p.health + 30);
          combat.floater(p.x, p.y - 26, '+30 HP', '#7CFC9a');
        }
        game.audio.pickup();
        pickup.timer = 45;
        pickup.x = random.pick(AVENUES) + random.range(-60, 60);
        pickup.y = random.pick(STREETS) + random.range(-60, 60);
      }
    }
  }

  function stepSprayShop(dt) {
    const p = game.player;
    const spray = PLACES.spray;
    const near = Math.hypot(p.x - spray.x, p.y - spray.y) < 130;
    game.prompt = '';
    if (p.inCar && near && game.wanted > 0) {
      if (game.money >= MONEY.sprayCost) {
        game.prompt = `Spray Shop — hold still to repaint ($${MONEY.sprayCost})`;
        if (Math.abs(p.car.speed) < 12) {
          game.sprayTimer += dt;
          if (game.sprayTimer > 2) {
            game.money -= MONEY.sprayCost;
            police.setHeat(0, game);
            game.sprayTimer = 0;
            combat.floater(p.x, p.y - 30, 'Clean ride — heat gone', '#7CFC9a');
            game.audio.pickup();
          }
        } else {
          game.sprayTimer = 0;
        }
      } else {
        game.prompt = `Spray Shop — need $${MONEY.sprayCost} to repaint`;
      }
    } else {
      game.sprayTimer = 0;
    }
  }

  function stepCamera(dt) {
    const p = game.player;
    const lookX = p.inCar && p.car ? Math.cos(p.car.angle) * 60 : 0;
    const lookY = p.inCar && p.car ? Math.sin(p.car.angle) * 60 : 0;
    const tx = p.x + lookX;
    const ty = p.y + lookY;
    game.camera.x += (tx - game.camera.x) * Math.min(1, 5 * dt);
    game.camera.y += (ty - game.camera.y) * Math.min(1, 5 * dt);
    game.shake = Math.max(0, game.shake - 30 * dt);
  }

  game.step = function (dt, input, aimAngle, actions) {
    if (game.busted || game.wasted) return;
    game.time += dt;
    game.save.playSeconds = Math.floor(game.time);
    const p = game.player;
    if (actions.enter) game.enterOrExitCar();
    if (p.inCar) stepPlayerCar(dt, input);
    else stepPlayerOnFoot(dt, input, aimAngle);
    stepTraffic(dt);
    stepPeds(dt);
    stepCops(dt);
    stepRivals(dt);
    stepBullets(dt);
    stepCarCollisions(dt);
    stepPickups(dt);
    stepSprayShop(dt);
    combat.step(dt);
    police.update(dt, game);
    missions.update(dt, game);
    if (!missions.isActive() && !game.storyDone && game.time >= game.nextMissionAt && game.nextMissionAt > 0) {
      game.startNextMission();
    }
    if (game.bannerTimer > 0) {
      game.bannerTimer -= dt;
      if (game.bannerTimer <= 0) game.banner = null;
    }
    stepCamera(dt);
    game.audio.engine(p.inCar ? Math.abs(p.car ? p.car.speed : 0) / CAR.maxSpeed : 0, p.inCar);
    game.audio.siren(police.sirenOn());
  };

  game.newGame = function () {
    game.startNextMission();
  };

  return game;
}
