// Combat: the player's gun and fists, rival crews who shoot back, bullets,
// explosions, and the cash, health and repair pickups scattered around town.
import { CFG } from './settings.js';
import { dist, clamp } from './dice.js';
import { addWanted, burst, addShake, toast } from './actors.js';

export function firePlayerShot(G) {
  const p = G.player;
  if (p.fireCd > 0 || p.reloading > 0 || p.car) return false;
  if (p.ammo <= 0) {
    p.reloading = CFG.reloadTime;
    G.synth.click();
    return false;
  }
  p.ammo--;
  p.fireCd = CFG.fireRate;
  G.stats.shotsFired++;
  const a = p.aim ?? p.angle;
  G.bullets.push({
    x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed,
    from: 'player', t: 0.9, damage: CFG.bulletDamage,
  });
  G.gunshotT = 1.2;
  G.synth.shot();
  addShake(G, 2);
  return true;
}

export function punch(G) {
  const p = G.player;
  if (p.punchCd > 0 || p.car) return;
  p.punchCd = 0.45;
  G.synth.punch();
  const a = p.aim ?? p.angle;
  const hx = p.x + Math.cos(a) * 30, hy = p.y + Math.sin(a) * 30;
  for (const r of G.rivals) {
    if (r.hp > 0 && dist(hx, hy, r.x, r.y) < CFG.punchRange + 12) {
      hurtRival(G, r, CFG.punchDamage);
      return;
    }
  }
  for (const ped of G.peds) {
    if (ped.state !== 'dead' && dist(hx, hy, ped.x, ped.y) < CFG.punchRange + 8) {
      ped.state = 'dead'; ped.hp = 0;
      addWanted(G, 1);
      burst(G, ped.x, ped.y, '#c94f43', 8);
      return;
    }
  }
}

export function hurtRival(G, r, dmg) {
  r.hp -= dmg;
  burst(G, r.x, r.y, '#d85a4a', 6);
  if (r.hp <= 0) {
    r.hp = 0;
    G.stats.rivalsDown++;
    G.synth.boom();
    burst(G, r.x, r.y, '#e8c84a', 16);
    dropPickup(G, r.x, r.y, 'cash');
  }
}

export function dropPickup(G, x, y, kind) {
  G.pickups.push({ x, y, kind, t: 0 });
}

export function scatterPickups(G) {
  for (let i = 0; i < 14; i++) {
    const spot = G.town.randomRoadSpot(G.dice);
    dropPickup(G, spot.x + G.dice.range(-30, 30), spot.y + G.dice.range(-30, 30), 'cash');
  }
  for (let i = 0; i < 6; i++) {
    const spot = G.town.randomRoadSpot(G.dice);
    dropPickup(G, spot.x, spot.y, 'health');
  }
  for (let i = 0; i < 4; i++) {
    const spot = G.town.randomRoadSpot(G.dice);
    dropPickup(G, spot.x, spot.y, 'repair');
  }
}

export function updateBullets(G, dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.t -= dt;
    let dead = b.t <= 0;
    if (!dead) {
      const probe = { x: b.x, y: b.y };
      if (G.town.resolveBuildings(probe, 2)) {
        burst(G, b.x, b.y, '#c9c9c9', 4);
        dead = true;
      }
    }
    if (!dead && b.from === 'player') {
      for (const r of G.rivals) {
        if (r.hp > 0 && dist(b.x, b.y, r.x, r.y) < 15) {
          hurtRival(G, r, b.damage);
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const ped of G.peds) {
          if (ped.state !== 'dead' && dist(b.x, b.y, ped.x, ped.y) < 13) {
            ped.state = 'dead'; ped.hp = 0;
            addWanted(G, 1);
            burst(G, ped.x, ped.y, '#c94f43', 10);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const cop of G.cops) {
          if (dist(b.x, b.y, cop.x, cop.y) < 24) {
            cop.hp -= b.damage;
            burst(G, b.x, b.y, '#3f7dc9', 8);
            if (cop.hp <= 0) {
              cop.hp = 100;
              cop.x = p.x + 700; cop.y = p.y + 700; // wrecked cruiser drops out, a fresh one comes in
              addWanted(G, 1);
              G.synth.boom();
              burst(G, cop.x, cop.y, '#e8c84a', 18);
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of G.cars) {
          if (car !== p.car && dist(b.x, b.y, car.x, car.y) < 26) {
            car.hp -= b.damage;
            car.smoke = 1;
            if (car.hp <= 0) explodeCar(G, car);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && b.from !== 'player') {
      if (p.car) {
        if (dist(b.x, b.y, p.x, p.y) < 26) {
          p.car.hp -= b.damage;
          p.car.smoke = 1;
          if (p.car.hp <= 0) explodeCar(G, p.car);
          dead = true;
        }
      } else if (p.invuln <= 0 && dist(b.x, b.y, p.x, p.y) < 13) {
        p.hp -= b.damage;
        p.invuln = 0.35;
        addShake(G, 4);
        dead = true;
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function explodeCar(G, car) {
  car.hp = 0;
  car.traffic = false;
  G.synth.boom();
  addShake(G, 12);
  burst(G, car.x, car.y, '#e86a2a', 26);
  burst(G, car.x, car.y, '#3a3f4a', 18);
  if (G.player.car === car) {
    G.player.car = null;
    G.player.hp -= 30;
    G.player.x = car.x + 40;
    G.player.y = car.y + 40;
    G.player.invuln = 1;
  }
  addWanted(G, 1);
}

export function updateRivals(G, dt) {
  const p = G.player;
  for (const r of G.rivals) {
    if (r.hp <= 0) continue;
    const d = dist(r.x, r.y, p.x, p.y);
    if (d > 520) continue;
    if (d > 260) {
      const a = Math.atan2(p.y - r.y, p.x - r.x);
      r.x += Math.cos(a) * 120 * dt;
      r.y += Math.sin(a) * 120 * dt;
      r.angle = a;
    } else {
      r.angle = Math.atan2(p.y - r.y, p.x - r.x);
      r.shootCd -= dt;
      if (r.shootCd <= 0) {
        r.shootCd = 1.1;
        const a = r.angle + G.dice.range(-0.1, 0.1);
        G.bullets.push({
          x: r.x + Math.cos(a) * 22, y: r.y + Math.sin(a) * 22,
          vx: Math.cos(a) * CFG.bulletSpeed, vy: Math.sin(a) * CFG.bulletSpeed,
          from: 'rival', t: 1.1, damage: CFG.rivalDamage,
        });
        G.synth.rivalShot();
      }
    }
    G.town.resolveBuildings(r, 11);
  }
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    k.t += dt;
    if (dist(p.x, p.y, k.x, k.y) < 30) {
      if (k.kind === 'cash') {
        p.money += CFG.pickupCash;
        G.synth.coin();
        toast(G, `+$${CFG.pickupCash} street cash`);
      } else if (k.kind === 'health') {
        p.hp = clamp(p.hp + 40, 0, CFG.playerHp);
        G.synth.heal();
        toast(G, 'Patched up +40 HP');
      } else if (k.kind === 'repair' && p.car) {
        p.car.hp = 100;
        p.car.smoke = 0;
        G.synth.heal();
        toast(G, 'Car repaired');
      } else if (k.kind === 'repair') {
        continue;
      }
      G.pickups.splice(i, 1);
    }
  }
}

export function updateParticles(G, dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const q = G.parts[i];
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.96; q.vy *= 0.96;
    q.t -= dt;
    if (q.t <= 0) G.parts.splice(i, 1);
  }
}
