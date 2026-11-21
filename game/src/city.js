// Palmera Bay, the city itself: a road grid, the blocks between the roads,
// and every named place the story uses. The layout is built once from a seed
// and never changes during play, so the minimap, the missions and the traffic
// all agree on where things are.

import { WORLD, PALETTE } from './config.js';

export const ROAD_W = 120;
export const SIDEWALK_W = 18;

// North-south avenues and east-west streets (centre lines, in world pixels).
export const AVENUES = [300, 900, 1500, 2100, 2700, 3300];
export const STREETS = [300, 800, 1300, 1800, 2300];

// Named places the missions and the HUD point at.
export const PLACES = {
  safehouse: { x: 1500, y: 300, label: 'Safehouse' },
  bank: { x: 2100, y: 1300, label: 'Harbor Bank' },
  garage: { x: 900, y: 1800, label: 'Rico\u2019s Garage' },
  spray: { x: 2700, y: 800, label: 'Spray Shop' },
  docks: { x: 3300, y: 2300, label: 'Docks' },
  marina: { x: 3300, y: 800, label: 'Marina' },
  warehouse: { x: 300, y: 1800, label: 'Warehouse Yard' },
  bar: { x: 1500, y: 2300, label: 'The Pelican Bar' },
  hospital: { x: 900, y: 300, label: 'St. Marina Hospital' },
  park: { x: 2100, y: 1800, label: 'Palm Park' },
  downtown: { x: 2100, y: 1300, label: 'Downtown' },
  beach: { x: 1800, y: 2520, label: 'Palmera Beach' },
};

function nearestLine(value, lines) {
  let best = lines[0];
  for (const line of lines) {
    if (Math.abs(line - value) < Math.abs(best - value)) best = line;
  }
  return best;
}

export function isOnRoad(x, y) {
  for (const a of AVENUES) if (Math.abs(x - a) <= ROAD_W / 2) return true;
  for (const s of STREETS) if (Math.abs(y - s) <= ROAD_W / 2) return true;
  return false;
}

export function isOnSidewalk(x, y) {
  for (const a of AVENUES) {
    const d = Math.abs(x - a);
    if (d > ROAD_W / 2 && d <= ROAD_W / 2 + SIDEWALK_W) return true;
  }
  for (const s of STREETS) {
    const d = Math.abs(y - s);
    if (d > ROAD_W / 2 && d <= ROAD_W / 2 + SIDEWALK_W) return true;
  }
  return false;
}

/** The closest point on any road centre line to (x, y). */
export function nearestRoadPoint(x, y) {
  const ax = nearestLine(x, AVENUES);
  const sy = nearestLine(y, STREETS);
  if (Math.abs(x - ax) <= Math.abs(y - sy)) return { x: ax, y, vertical: true };
  return { x, y: sy, vertical: false };
}

export function buildCity(random) {
  const buildings = [];
  const trees = [];
  const parking = [];

  // One or two buildings per block, kept clear of the named places.
  for (let ai = 0; ai < AVENUES.length - 1; ai += 1) {
    for (let si = 0; si < STREETS.length - 1; si += 1) {
      const x0 = AVENUES[ai] + ROAD_W / 2 + SIDEWALK_W + 14;
      const x1 = AVENUES[ai + 1] - ROAD_W / 2 - SIDEWALK_W - 14;
      const y0 = STREETS[si] + ROAD_W / 2 + SIDEWALK_W + 14;
      const y1 = STREETS[si + 1] - ROAD_W / 2 - SIDEWALK_W - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      // Palm Park replaces the buildings of its block.
      if (Math.abs(cx - PLACES.park.x) < 200 && Math.abs(cy - PLACES.park.y) < 200) {
        for (let t = 0; t < 26; t += 1) {
          trees.push({
            x: random.range(x0 + 20, x1 - 20),
            y: random.range(y0 + 20, y1 - 20),
            r: random.range(10, 17),
          });
        }
        continue;
      }
      const downtown = Math.abs(cx - 2100) < 400 && Math.abs(cy - 1300) < 400;
      const count = random.chance(0.35) ? 2 : 1;
      for (let b = 0; b < count; b += 1) {
        const w = random.range(90, count === 1 ? x1 - x0 - 40 : (x1 - x0) / 2 - 30);
        const h = random.range(80, y1 - y0 - 40);
        const bx = count === 1 ? cx - w / 2 : x0 + 10 + b * ((x1 - x0) / 2);
        const by = cy - h / 2 + random.range(-14, 14);
        const building = {
          x: bx,
          y: by,
          w,
          h,
          tall: downtown && random.chance(0.6),
          color: random.pick(PALETTE.buildingRoof),
        };
        let clash = false;
        for (const place of Object.values(PLACES)) {
          if (place.x > bx - 90 && place.x < bx + w + 90 && place.y > by - 90 && place.y < by + h + 90) clash = true;
        }
        if (!clash) buildings.push(building);
      }
      // A few palm trees along the block edge.
      for (let t = 0; t < 3; t += 1) {
        trees.push({ x: random.range(x0, x1), y: y0 + 8, r: random.range(9, 13) });
      }
    }
  }

  // Parked cars tucked against the kerb on the avenues.
  for (let i = 0; i < 14; i += 1) {
    const avenue = random.pick(AVENUES);
    const street = random.pick(STREETS);
    parking.push({
      x: avenue + (random.chance(0.5) ? 1 : -1) * (ROAD_W / 2 - 18),
      y: street + random.range(-260, 260),
      angle: random.chance(0.5) ? Math.PI / 2 : -Math.PI / 2,
      kind: random.pick(['sedan', 'hatch', 'pickup', 'taxi']),
    });
  }
  // Beach palms.
  for (let t = 0; t < 22; t += 1) {
    trees.push({ x: random.range(120, WORLD.width - 120), y: random.range(2440, 2560), r: random.range(10, 16) });
  }

  return { buildings, trees, parking };
}

/** True when the point (with radius r) is inside a building or outside the world. */
export function hitsSolid(city, x, y, r) {
  if (x < r || y < r || x > WORLD.width - r || y > WORLD.height - r) return true;
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
  }
  return false;
}

/** Push a point out of buildings and the world edge; returns the corrected point. */
export function pushOutOfSolid(city, x, y, r) {
  let px = x;
  let py = y;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - cx;
    const dy = py - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        px = cx + (dx / d) * r;
        py = cy + (dy / d) * r;
      } else {
        py = b.y - r;
      }
    }
  }
  px = Math.max(r, Math.min(WORLD.width - r, px));
  py = Math.max(r, Math.min(WORLD.height - r, py));
  return { x: px, y: py };
}

export function resolveSolid(city, body) {
  let moved = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.radius * body.radius) {
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * body.radius;
        body.y = cy + (dy / d) * body.radius;
      } else {
        body.y = b.y - body.radius;
      }
      moved = true;
    }
  }
  body.x = Math.max(body.radius, Math.min(WORLD.width - body.radius, body.x));
  body.y = Math.max(body.radius, Math.min(WORLD.height - body.radius, body.y));
  return moved;
}
