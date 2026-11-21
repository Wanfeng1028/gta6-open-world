// The people and vehicles of Palmera Bay: the player on foot and behind
// the wheel, pedestrians going about their day, traffic following the roads,
// and the police who answer the wanted level.
import { CFG, CAR_MODELS, PED_SHIRTS, PED_SKINS } from './settings.js';
import { clamp, dist, angDiff } from './dice.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: CFG.playerHp, money: CFG.moneyStart,
    ammo: CFG.clipSize, reloading: 0, fireCd: 0, punchCd: 0,
    car: null, speed: 0, walkX: 0, walkY: 0, moving: false,
    invuln: 0, dead: false, busted: 0,
  };
}

export function makeCar(dice, x, y, vertical, parked) {
  const model = dice.pick(CAR_MODELS);
  return {
    x, y,
    angle: vertical ? (dice.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (dice.chance(0.5) ? 0 : Math.PI),
    speed: 0,
    model: model.name, body: model.body, top: model.top,
    len: model.len, wid: model.wid,
    traffic: !parked, parked: !!parked,
    dir: dice.chance(0.5) ? 1 : -1,
    lane: dice.range(-14, 14),
    hp: 100, smoke: 0, driver: null,
    stuck: 0,
  };
}

export function spawnPeds(dice, town, n) {
  const peds = [];
  for (let i = 0; i < n; i++) {
    const spot = town.randomRoadSpot(dice);
    const side = dice.chance(0.5) ? 1 : -1;
    const px = spot.vertical ? spot.x + side * (CFG.roadW / 2 + 12) : spot.x;
    const py = spot.vertical ? spot.y : spot.y + side * (CFG.roadW / 2 + 12);
    peds.push({
      x: clamp(px, 20, town.W - 20), y: clamp(py, 20, town.H - 220),
      angle: dice.angle(), speed: dice.range(38, 72),
      shirt: dice.pick(PED_SHIRTS), skin: dice.pick(PED_SKINS),
      state: 'walk', hp: 30, fleeT: 0, panic: 0,
      target: null,
    });
  }
  return peds;
}

export function spawnTraffic(dice, town, n) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const spot = town.randomRoadSpot(dice);
    const car = makeCar(dice, spot.x, spot.y, spot.vertical, false);
    car.speed = dice.range(110, CFG.trafficSpeed);
    cars.push(car);
  }
  // A few parked cars the player can steal right away.
  for (let i = 0; i < 8; i++) {
    const spot = town.randomRoadSpot(dice);
    const off = dice.chance(0.5) ? 1 : -1;
    const car = makeCar(dice,
      spot.vertical ? spot.x + off * (CFG.roadW / 2 - 12) : spot.x,
      spot.vertical ? spot.y : spot.y + off * (CFG.roadW / 2 - 12),
      spot.vertical, true);
    car.angle = spot.vertical ? (off > 0 ? Math.PI / 2 : -Math.PI / 2) : (off > 0 ? 0 : Math.PI);
    cars.push(car);
  }
  return cars;
}

export function nearestCar(G, x, y, maxD) {
  let best = null, bd = maxD;
  for (const c of G.cars) {
    if (c === G.player.car) continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

export function stealCar(G, car) {
  const p = G.player;
  if (!car) return false;
  if (car.traffic && car.driver !== 'player') {
    // Yank the driver out; they run off screaming.
    G.peds.push({
      x: car.x + 26, y: car.y + 26, angle: 0, speed: 150,
      shirt: '#e8e8e8', skin: '#e8b98c', state: 'flee', hp: 30, fleeT: 3, panic: 1, target: null,
    });
    car.traffic = false;
    car.driver = null;
    addWanted(G, 1);
    G.synth.steal();
    toast(G, 'Car stolen — the cops noticed');
  }
  car.parked = false;
  p.car = car;
  p.x = car.x; p.y = car.y;
  car.driver = 'player';
  G.stats.carsStolen++;
  return true;
}

export function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  car.driver = null;
  car.speed = 0;
  car.parked = true;
  const side = Math.cos(p.angle + Math.PI / 2);
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
  void side;
  p.car = null;
  p.speed = 0;
}

export function addWanted(G, n) {
  G.wanted = clamp(G.wanted + n, 0, CFG.wantedMax);
  G.wantedShown = Math.ceil(G.wanted);
}

export function toast(G, text) {
  G.toasts.push({ text, t: 4 });
  if (G.toasts.length > 3) G.toasts.shift();
}

// ---- per-frame updates ----

export function updatePlayer(G, dt, keys) {
  const p = G.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) p.ammo = CFG.clipSize;
  }
  if (p.car) {
    drivePlayerCar(G, dt, keys);
    return;
  }
  const v = keys.walkVector();
  const sprint = keys.is('ShiftLeft') || keys.is('ShiftRight');
  const speed = CFG.walkSpeed * (sprint ? CFG.sprintMul : 1);
  p.moving = v.active;
  if (v.active) {
    p.x += v.x * speed * dt;
    p.y += v.y * speed * dt;
    p.angle = Math.atan2(v.y, v.x);
  }
  p.x = clamp(p.x, 16, G.town.W - 16);
  p.y = clamp(p.y, 16, G.town.H - 16);
  G.town.resolveBuildings(p, CFG.playerRadius);
  // Aim follows the mouse.
  const wx = G.cam.x + keys.mouse.x - CFG.viewW / 2;
  const wy = G.cam.y + keys.mouse.y - CFG.viewH / 2;
  p.aim = Math.atan2(wy - p.y, wx - p.x);
}

function drivePlayerCar(G, dt, keys) {
  const p = G.player;
  const car = p.car;
  const throttle = (keys.is('KeyW') || keys.is('ArrowUp') ? 1 : 0) - (keys.is('KeyS') || keys.is('ArrowDown') ? 1 : 0);
  const steer = (keys.is('KeyA') || keys.is('ArrowLeft') ? 1 : 0) - (keys.is('KeyD') || keys.is('ArrowRight') ? 1 : 0);
  if (throttle > 0) car.speed += CFG.carAccel * dt;
  else if (throttle < 0) car.speed -= (car.speed > 20 ? CFG.carBrake : CFG.carReverse) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 300 * dt);
  car.speed = clamp(car.speed, -CFG.carReverse, car.top);
  const grip = clamp(Math.abs(car.speed) / 120, 0.25, 1);
  car.angle += steer * CFG.carTurn * grip * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const probe = { x: nx, y: ny };
  if (G.town.resolveBuildings(probe, CFG.carRadius)) {
    if (Math.abs(car.speed) > 240) {
      G.synth.crash();
      car.hp -= 8;
      car.smoke = 1;
      addShake(G, 6);
    }
    car.speed *= 0.35;
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = clamp(car.x, 24, G.town.W - 24);
  car.y = clamp(car.y, 24, G.town.H - 24);
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  p.speed = car.speed;
  G.synth.engine(Math.abs(car.speed) / car.top);
  // Running over a pedestrian is a crime, and it shows.
  for (const ped of G.peds) {
    if (ped.state !== 'dead' && Math.abs(car.speed) > 120 && dist(car.x, car.y, ped.x, ped.y) < 26) {
      ped.state = 'dead'; ped.hp = 0;
      addWanted(G, 1);
      G.synth.crash();
      addShake(G, 5);
      burst(G, ped.x, ped.y, '#c94f43', 10);
    }
  }
}

export function addShake(G, n) {
  G.shake = Math.max(G.shake || 0, n);
}

export function burst(G, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = G.dice.angle();
    const s = G.dice.range(40, 190);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: G.dice.range(0.3, 0.8), max: 0.8, color, size: G.dice.range(2, 5) });
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.state === 'dead') continue;
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const dx = ped.x - G.player.x, dy = ped.y - G.player.y;
      const d = Math.hypot(dx, dy) || 1;
      ped.x += (dx / d) * 150 * dt;
      ped.y += (dy / d) * 150 * dt;
      ped.angle = Math.atan2(dy, dx);
      if (ped.fleeT <= 0) ped.state = 'walk';
    } else {
      if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 12) {
        const spot = G.town.randomRoadSpot(G.dice);
        const side = G.dice.chance(0.5) ? 1 : -1;
        ped.target = {
          x: clamp(spot.vertical ? spot.x + side * 66 : spot.x, 20, G.town.W - 20),
          y: clamp(spot.vertical ? spot.y : spot.y + side * 66, 20, G.town.H - 220),
        };
      }
      const dx = ped.target.x - ped.x, dy = ped.target.y - ped.y;
      const d = Math.hypot(dx, dy) || 1;
      ped.x += (dx / d) * ped.speed * dt;
      ped.y += (dy / d) * ped.speed * dt;
      ped.angle = Math.atan2(dy, dx);
      // A gunshot nearby sends everyone running.
      if (G.gunshotT > 0 && dist(ped.x, ped.y, G.player.x, G.player.y) < 260) {
        ped.state = 'flee'; ped.fleeT = 2.5;
      }
    }
    G.town.resolveBuildings(ped, 10);
    ped.x = clamp(ped.x, 14, G.town.W - 14);
    ped.y = clamp(ped.y, 14, G.town.H - 14);
  }
  if (G.gunshotT > 0) G.gunshotT -= dt;
}

export function updateTraffic(G, dt) {
  const p = G.player;
  for (const car of G.cars) {
    if (!car.traffic || car === p.car) continue;
    // Drive along the road; pick a new direction at intersections.
    const onV = Math.abs(car.x - nearestRoad(G.town.vRoads, car.x)) < 4;
    const onH = Math.abs(car.y - nearestRoad(G.town.hRoads, car.y)) < 4;
    if (onV && onH && G.dice.chance(dt * 0.35)) {
      car.angle = G.dice.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    }
    // Slow down for the car ahead.
    let blocked = false;
    for (const other of G.cars) {
      if (other === car || other === p.car) continue;
      const dx = other.x - car.x, dy = other.y - car.y;
      const ahead = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (ahead > 0 && ahead < 64 && side < 26) { blocked = true; break; }
    }
    const target = blocked ? 0 : car.speed || 140;
    car.speed += clamp(target - car.speed, -260 * dt, 200 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Stay on the road: nudge back toward the centre-line.
    const rp = G.town.roadPoint(car.x, car.y);
    if (rp.vertical) car.x += (rp.x + car.lane - car.x) * Math.min(1, dt * 1.5);
    else car.y += (rp.y + car.lane - car.y) * Math.min(1, dt * 1.5);
    car.x = clamp(car.x, 20, G.town.W - 20);
    car.y = clamp(car.y, 20, G.town.H - 240);
    // Fleeing a crash: a hit car swerves off and stops.
    if (car.hp < 40) car.traffic = false;
  }
}

function nearestRoad(list, v) {
  let best = list[0], bd = 1e9;
  for (const r of list) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return best;
}

export function makeCop(dice, x, y) {
  return {
    x, y, angle: 0, speed: 0, top: 560,
    body: '#1a1a22', accent: '#3f7dc9', len: 56, wid: 26,
    hp: 100, shootCd: 0, siren: true, ramCd: 0,
  };
}

export function updateCops(G, dt) {
  const p = G.player;
  const want = Math.ceil(G.wanted);
  const target = want === 0 ? 0 : want + 1;
  // Spawn police at the edge of the view, on roads, heading for the player.
  while (G.cops.length < target) {
    const a = G.dice.angle();
    const sx = p.x + Math.cos(a) * 620;
    const sy = p.y + Math.sin(a) * 620;
    const rp = G.town.roadPoint(clamp(sx, 40, G.town.W - 40), clamp(sy, 40, G.town.H - 240));
    G.cops.push(makeCop(G.dice, rp.x, rp.y));
  }
  while (G.cops.length > target) G.cops.pop();
  let near = false;
  for (const cop of G.cops) {
    const d = dist(cop.x, cop.y, p.x, p.y);
    if (d < 520) near = true;
    const wantAngle = Math.atan2(p.y - cop.y, p.x - cop.x);
    const turn = angDiff(cop.angle, wantAngle);
    cop.angle += clamp(turn, -2.6 * dt, 2.6 * dt);
    const cruise = 300 + G.wanted * 46;
    cop.speed += clamp(cruise - cop.speed, -500 * dt, 380 * dt);
    const nx = cop.x + Math.cos(cop.angle) * cop.speed * dt;
    const ny = cop.y + Math.sin(cop.angle) * cop.speed * dt;
    const probe = { x: nx, y: ny };
    if (!G.town.resolveBuildings(probe, CFG.carRadius)) { cop.x = nx; cop.y = ny; }
    else cop.speed *= 0.4;
    // Ram the player's car; bump the player on foot.
    if (d < 44) {
      if (p.car) {
        if (cop.ramCd <= 0) {
          p.car.hp -= CFG.copRamDamage;
          p.car.smoke = 1;
          cop.ramCd = 1.2;
          G.synth.crash();
          addShake(G, 7);
        }
      } else if (p.invuln <= 0) {
        p.hp -= 12;
        p.invuln = 0.8;
        p.busted = 0;
        addShake(G, 8);
        G.synth.crash();
        if (p.hp <= 0) { p.hp = 0; }
      }
    }
    if (cop.ramCd > 0) cop.ramCd -= dt;
    // At 3 stars and up the police shoot.
    if (G.wanted >= 3 && d < 420 && cop.shootCd <= 0) {
      cop.shootCd = 0.9;
      fireCopShot(G, cop);
    }
    if (cop.shootCd > 0) cop.shootCd -= dt;
    // Busted: a cop stands over the player on foot for a while.
    if (!p.car && d < CFG.bustRadius && G.wanted > 0) {
      p.busted += dt;
      if (p.busted > 1.6) G.screen = 'busted';
    } else {
      p.busted = Math.max(0, p.busted - dt * 2);
    }
  }
  G.synth.siren(near && G.wanted > 0, dt);
  // Wanted fades when no cop can see the player.
  if (G.wanted > 0 && !near) {
    G.wanted = Math.max(0, G.wanted - CFG.wantedDecay * dt);
    G.wantedShown = Math.ceil(G.wanted);
  }
}

function fireCopShot(G, cop) {
  const p = G.player;
  const a = Math.atan2(p.y - cop.y, p.x - cop.x) + G.dice.range(-0.12, 0.12);
  G.bullets.push({
    x: cop.x + Math.cos(a) * 30, y: cop.y + Math.sin(a) * 30,
    vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed,
    from: 'cop', t: 1.2, damage: 9,
  });
  G.synth.rivalShot();
}
