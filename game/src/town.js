// The city of Palmera Bay: a road grid, building blocks, a beach along the
// south shore, a park, and the named places the story sends the player to.
// Everything is placed from a seeded dice roll, so the city is identical
// for a given seed.
import { CFG, PALETTE } from './settings.js';
import { clamp } from './dice.js';

export function buildTown(dice) {
  const W = CFG.worldW;
  const H = CFG.worldH;
  const step = CFG.block;
  const half = CFG.roadW / 2;

  const vRoads = [];
  for (let x = 0; x <= W; x += step) vRoads.push(x);
  const hRoads = [];
  for (let y = 0; y <= H - 220; y += step) hRoads.push(y);

  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];

  // A park block and a plaza block stay open.
  const parkCol = 4, parkRow = 2;
  const plazaCol = 1, plazaRow = 3;

  for (let ci = 0; ci < vRoads.length - 1; ci++) {
    for (let ri = 0; ri < hRoads.length - 1; ri++) {
      const x0 = vRoads[ci] + half + CFG.sidewalk;
      const y0 = hRoads[ri] + half + CFG.sidewalk;
      const x1 = vRoads[ci + 1] - half - CFG.sidewalk;
      const y1 = hRoads[ri + 1] - half - CFG.sidewalk;
      const bw = x1 - x0, bh = y1 - y0;
      if (bw < 60 || bh < 60) continue;
      if (ci === parkCol && ri === parkRow) {
        parks.push({ x: x0, y: y0, w: bw, h: bh, kind: 'park' });
        for (let t = 0; t < 14; t++) {
          trees.push({ x: dice.range(x0 + 14, x1 - 14), y: dice.range(y0 + 14, y1 - 14), r: dice.range(7, 11) });
        }
        continue;
      }
      if (ci === plazaCol && ri === plazaRow) {
        parks.push({ x: x0, y: y0, w: bw, h: bh, kind: 'plaza' });
        continue;
      }
      // One or two buildings per block, with a yard gap between them.
      const split = dice.chance(0.55) && bw > 170;
      const lots = split
        ? [{ x: x0, y: y0, w: bw * 0.46, h: bh }, { x: x0 + bw * 0.54, y: y0, w: bw * 0.46, h: bh }]
        : [{ x: x0, y: y0, w: bw, h: bh }];
      for (const lot of lots) {
        const inset = dice.range(6, 16);
        const b = {
          x: lot.x + inset,
          y: lot.y + inset,
          w: lot.w - inset * 2,
          h: lot.h - inset * 2,
          color: dice.pick(PALETTE.buildingRoof),
          floors: dice.int(1, 4),
          label: '',
        };
        buildings.push(b);
        if (dice.chance(0.5)) {
          trees.push({ x: b.x - 8 + dice.range(0, b.w + 16), y: b.y + b.h + 14, r: dice.range(6, 9) });
        }
      }
    }
  }

  // Lamps along every road, staggered.
  for (const x of vRoads) {
    for (let y = 120; y < H - 260; y += 340) {
      lamps.push({ x: x + half + 6, y, vertical: true });
    }
  }
  for (const y of hRoads) {
    for (let x = 120; x < W - 120; x += 340) {
      lamps.push({ x, y: y + half + 6, vertical: false });
    }
  }

  // Named places. Each sits on a road corner so the player can reach it.
  const at = (cx, cy) => ({ x: vRoads[cx] || cx * step, y: hRoads[cy] || cy * step });
  const safe = at(1, 3); safe.y += 30;
  const markers = {
    safehouse: { ...safe, name: 'Safehouse', color: '#5ad88c' },
    paintshop: { x: vRoads[6], y: hRoads[1], name: 'Paint Shop', color: '#e8c84a' },
    dock: { x: vRoads[2], y: hRoads[6], name: 'Old Dock', color: '#4ad8d0' },
    bank: { x: vRoads[5], y: hRoads[2], name: 'Bay Bank', color: '#e8e84a' },
    marina: { x: vRoads[8], y: hRoads[6], name: 'Marina', color: '#4a8fd8' },
    yard: { x: vRoads[9], y: hRoads[4], name: 'The Yards', color: '#d85a4a' },
    chapel: { x: vRoads[3], y: hRoads[0], name: 'Chapel', color: '#c9c9c9' },
  };
  // Label the buildings nearest the named places.
  const labelNear = (m, label) => {
    let best = null, bd = 1e9;
    for (const b of buildings) {
      const d = Math.hypot(b.x + b.w / 2 - m.x, b.y + b.h / 2 - m.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) best.label = label;
  };
  labelNear(markers.bank, 'BAY BANK');
  labelNear(markers.dock, 'DOCK 7');
  labelNear(markers.yard, 'YARDS');
  labelNear(markers.marina, 'MARINA');

  const town = { vRoads, hRoads, buildings, trees, lamps, parks, markers, W, H, beachY: H - 200, seaY: H - 90 };

  town.onRoad = (x, y) => {
    for (const rx of vRoads) if (Math.abs(x - rx) <= half) return true;
    for (const ry of hRoads) if (Math.abs(y - ry) <= half) return true;
    return false;
  };

  town.roadPoint = (x, y) => {
    // Nearest point on a road centre-line, for spawning cars and peds.
    let bx = vRoads[0], bd = 1e9;
    for (const rx of vRoads) { const d = Math.abs(x - rx); if (d < bd) { bd = d; bx = rx; } }
    let by = hRoads[0]; bd = 1e9;
    for (const ry of hRoads) { const d = Math.abs(y - ry); if (d < bd) { bd = d; by = ry; } }
    return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y: clamp(y, 40, H - 240), vertical: true } : { x: clamp(x, 40, W - 40), y: by, vertical: false };
  };

  town.blockedAt = (x, y, r) => {
    if (x < r || y < r || x > W - r || y > H - r) return true;
    for (const b of buildings) {
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  };

  // Push a circle out of buildings; returns true when a push happened.
  town.resolveBuildings = (e, r) => {
    let hit = false;
    for (const b of buildings) {
      const nx = clamp(e.x, b.x, b.x + b.w);
      const ny = clamp(e.y, b.y, b.y + b.h);
      const dx = e.x - nx, dy = e.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.01) {
          const d = Math.sqrt(d2);
          e.x = nx + (dx / d) * r;
          e.y = ny + (dy / d) * r;
        } else {
          e.x = b.x - r;
        }
      }
    }
    return hit;
  };

  town.randomRoadSpot = (d) => {
    if (d.chance(0.5)) {
      return { x: d.pick(vRoads), y: d.range(60, H - 280), vertical: true };
    }
    return { x: d.range(60, W - 60), y: d.pick(hRoads), vertical: false };
  };

  return town;
}
