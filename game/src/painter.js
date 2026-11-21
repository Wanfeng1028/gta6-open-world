// Every picture in the game is drawn here on the canvas: the city, its cars
// and people, bullets and smoke, and the arrow that points at the job.
import { CFG, PALETTE } from './settings.js';
import { clamp } from './dice.js';

export function drawWorld(ctx, G, cam) {
  const T = G.town;
  const x0 = cam.x - CFG.viewW / 2 - 40, y0 = cam.y - CFG.viewH / 2 - 40;
  const x1 = cam.x + CFG.viewW / 2 + 40, y1 = cam.y + CFG.viewH / 2 + 40;

  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Mown stripes for a little texture.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 120;
  for (let sy = Math.floor(y0 / stripe) * stripe; sy < y1; sy += stripe * 2) {
    ctx.fillRect(x0, sy, x1 - x0, stripe);
  }
  // Beach and sea along the south shore.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(x0, Math.max(y0, T.beachY), x1 - x0, Math.max(0, y1 - Math.max(y0, T.beachY)));
  ctx.fillStyle = PALETTE.sea;
  ctx.fillRect(x0, Math.max(y0, T.seaY), x1 - x0, Math.max(0, y1 - Math.max(y0, T.seaY)));
  ctx.fillStyle = PALETTE.seaDeep;
  for (let wy = T.seaY + 24; wy < y1; wy += 46) {
    ctx.fillRect(x0 + ((wy * 7) % 300), wy, 90, 3);
  }

  // Parks and the plaza.
  for (const pk of T.parks) {
    if (pk.x > x1 || pk.x + pk.w < x0 || pk.y > y1 || pk.y + pk.h < y0) continue;
    ctx.fillStyle = pk.kind === 'park' ? PALETTE.park : '#b8a888';
    ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
    if (pk.kind === 'plaza') {
      ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 3;
      ctx.strokeRect(pk.x + 8, pk.y + 8, pk.w - 16, pk.h - 16);
    }
  }

  // Roads: asphalt, pale sidewalks, dashed centre lines.
  for (const rx of T.vRoads) drawRoadV(ctx, rx, y0, y1);
  for (const ry of T.hRoads) drawRoadH(ctx, ry, x0, x1);

  // Buildings with window grids and the odd rooftop label.
  for (const b of T.buildings) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(20,24,40,0.55)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(b.x + 8 + c * 26, b.y + 8 + r * 26, 12, 9);
      }
    }
    if (b.label) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 5);
    }
  }

  // Trees and lamps.
  for (const t of T.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7d33';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#2a2a30';
  for (const l of T.lamps) {
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
    ctx.fillStyle = '#e8d84a';
    ctx.beginPath(); ctx.arc(l.x, l.y, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a2a30';
  }

  drawMarkers(ctx, G, cam);
}

function drawRoadV(ctx, x, y0, y1) {
  ctx.fillStyle = PALETTE.sidewalkCol;
  ctx.fillRect(x - CFG.roadW / 2 - CFG.sidewalk, y0, CFG.roadW + CFG.sidewalk * 2, y1 - y0);
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(x - CFG.roadW / 2, y0, CFG.roadW, y1 - y0);
  ctx.fillStyle = PALETTE.line;
  for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(x - 2, y, 4, 22);
}

function drawRoadH(ctx, y, x0, x1) {
  ctx.fillStyle = PALETTE.sidewalkCol;
  ctx.fillRect(x0, y - CFG.roadW / 2 - CFG.sidewalk, x1 - x0, CFG.roadW + CFG.sidewalk * 2);
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(x0, y - CFG.roadW / 2, x1 - x0, CFG.roadW);
  ctx.fillStyle = PALETTE.line;
  for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, y - 2, 22, 4);
}

function drawMarkers(ctx, G, cam) {
  const T = G.town;
  const m = G.mission;
  // Mission target: a pulsing beacon the player can see across the city.
  if (m.active && m.target) {
    const pulse = 1 + Math.sin(G.time * 4) * 0.25;
    ctx.strokeStyle = '#e8c84a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(m.target.x, m.target.y, 26 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e8c84a';
    ctx.beginPath(); ctx.arc(m.target.x, m.target.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1a1a1a';
    const label = m.target.name || 'JOB';
    const w = ctx.measureText(label).width + 16;
    ctx.fillStyle = 'rgba(232,200,74,0.95)';
    roundRect(ctx, m.target.x - w / 2, m.target.y - 52, w, 22, 10);
    ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.fillText(label, m.target.x, m.target.y - 37);
  }
  // Safehouse: a small green house pin.
  const s = T.markers.safehouse;
  ctx.fillStyle = '#5ad88c';
  ctx.beginPath(); ctx.arc(s.x, s.y, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a5a2a';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('H', s.x, s.y + 4);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('Safehouse', s.x, s.y + 28);
  void cam;
}

export function drawCarShape(ctx, car, isCop) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const L = car.len, Wd = car.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  roundRect(ctx, -L / 2 + 3, -Wd / 2 + 4, L, Wd, 7);
  ctx.fill();
  ctx.fillStyle = car.body;
  roundRect(ctx, -L / 2, -Wd / 2, L, Wd, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = '#20242e';
  roundRect(ctx, -L * 0.18, -Wd / 2 + 4, L * 0.34, Wd - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.5)';
  ctx.fillRect(-L * 0.18, -Wd / 2 + 5, 5, Wd - 10);
  // Headlights and taillights.
  ctx.fillStyle = '#ffe9a0';
  ctx.fillRect(L / 2 - 3, -Wd / 2 + 3, 3, 5);
  ctx.fillRect(L / 2 - 3, Wd / 2 - 8, 3, 5);
  ctx.fillStyle = '#c94f43';
  ctx.fillRect(-L / 2, -Wd / 2 + 3, 3, 5);
  ctx.fillRect(-L / 2, Wd / 2 - 8, 3, 5);
  if (isCop) {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-L * 0.05, -Wd / 2, L * 0.28, Wd);
    ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 === 0) ? '#ff4040' : '#4060ff';
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (car.smoke > 0) {
    ctx.fillStyle = 'rgba(120,120,120,0.6)';
    ctx.beginPath(); ctx.arc(-L / 2 + 4, 0, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawPerson(ctx, x, y, angle, shirt, skin, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 3, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(angle);
  // Body.
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
  // Head / face direction.
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(6, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  if (o.gun) {
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(22, 0); ctx.stroke();
  }
  if (o.ring) {
    ctx.strokeStyle = o.ring;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

export function drawEntities(ctx, G) {
  // Pickups.
  for (const k of G.pickups) {
    const bob = Math.sin(G.time * 3 + k.x) * 3;
    if (k.kind === 'cash') {
      ctx.fillStyle = '#1f9e4a';
      ctx.beginPath(); ctx.arc(k.x, k.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8f5e8';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('$', k.x, k.y + bob + 5);
    } else if (k.kind === 'health') {
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(k.x - 11, k.y - 11 + bob, 22, 22);
      ctx.fillStyle = '#c94f43';
      ctx.fillRect(k.x - 3, k.y - 8 + bob, 6, 16);
      ctx.fillRect(k.x - 8, k.y - 3 + bob, 16, 6);
    } else {
      ctx.fillStyle = '#c9a13a';
      ctx.beginPath(); ctx.arc(k.x, k.y + bob, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5a4a1a';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(k.x, k.y + bob, 5, 0.5, Math.PI * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(k.x + 4, k.y + bob + 4); ctx.lineTo(k.x + 8, k.y + bob + 8); ctx.stroke();
    }
  }
  // Traffic and parked cars (the player's car is drawn with them).
  for (const car of G.cars) drawCarShape(ctx, car, false);
  // Police cruisers.
  for (const cop of G.cops) drawCarShape(ctx, cop, true);
  // Pedestrians.
  for (const ped of G.peds) {
    if (ped.state === 'dead') {
      ctx.save();
      ctx.translate(ped.x, ped.y);
      ctx.rotate(1.2);
      ctx.fillStyle = ped.shirt;
      ctx.fillRect(-11, -5, 22, 10);
      ctx.fillStyle = ped.skin;
      ctx.beginPath(); ctx.arc(13, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.shirt, ped.skin, {});
  }
  // Rivals: red shirts, guns out, a red ring so the player reads them.
  for (const r of G.rivals) {
    if (r.hp <= 0) continue;
    drawPerson(ctx, r.x, r.y, r.angle, '#c92a2a', '#e8b98c', { gun: true, ring: '#ff5040' });
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(r.x - 14, r.y - 26, 28, 5);
    ctx.fillStyle = '#ff5040';
    ctx.fillRect(r.x - 14, r.y - 26, 28 * Math.max(0, r.hp / 60), 5);
  }
  // The player (on foot only — in a car the car is the player).
  const p = G.player;
  if (!p.car) {
    const ring = p.invuln > 0 && Math.floor(G.time * 10) % 2 === 0 ? '#ffffff' : '#ffffff';
    drawPerson(ctx, p.x, p.y, p.aim ?? p.angle, '#3f7dc9', '#e8b98c', { gun: true, ring });
    // Busted progress ring.
    if (p.busted > 0) {
      ctx.strokeStyle = '#ff4040';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(p.x, p.y, 24, -Math.PI / 2, -Math.PI / 2 + (p.busted / 1.6) * Math.PI * 2); ctx.stroke();
    }
  }
  // Bullets.
  ctx.strokeStyle = '#ffe9a0';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.stroke();
  }
  // Particles.
  for (const q of G.parts) {
    ctx.globalAlpha = clamp(q.t / q.max, 0, 1);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
}

export function drawOffscreenArrow(ctx, G) {
  const m = G.mission;
  if (!m.active || !m.target) return;
  const tx = m.target.x - G.cam.x + CFG.viewW / 2;
  const ty = m.target.y - G.cam.y + CFG.viewH / 2;
  if (tx > 60 && tx < CFG.viewW - 60 && ty > 60 && ty < CFG.viewH - 60) return;
  const cx = clamp(tx, 50, CFG.viewW - 50);
  const cy = clamp(ty, 50, CFG.viewH - 50);
  const a = Math.atan2(ty - CFG.viewH / 2, tx - CFG.viewW / 2);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = '#e8c84a';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
