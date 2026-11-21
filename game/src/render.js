// Everything the player sees: the city, the cars, the people, the HUD with
// its minimap, and every menu. Canvas 2D only, all art drawn from shapes —
// no images, no fonts beyond the system stack.

import { WORLD, PALETTE, FONT } from './config.js';
import { AVENUES, STREETS, PLACES, ROAD_W } from './city.js';
import { MISSIONS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_HELP = 'help';

const MINIMAP = { w: 210, h: 152, x: 16, y: 0 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, x, y, r, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(angle) * rad;
    const py = y + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd94d' : 'rgba(255,255,255,0.22)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let view = { w: 1280, h: 720, scale: 1, ox: 0, oy: 0 };

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    view.w = canvas.width;
    view.h = canvas.height;
    view.scale = Math.max(view.w / 1150, view.h / 780) * dpr;
  }
  resize();
  window.addEventListener('resize', resize);

  function cameraTransform(game) {
    const vw = view.w / view.scale;
    const vh = view.h / view.scale;
    let cx = game.camera.x;
    let cy = game.camera.y;
    if (vw < WORLD.width) cx = Math.max(vw / 2, Math.min(WORLD.width - vw / 2, cx));
    else cx = WORLD.width / 2;
    if (vh < WORLD.height) cy = Math.max(vh / 2, Math.min(WORLD.height - vh / 2, cy));
    else cy = WORLD.height / 2;
    const shakeX = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    const shakeY = game.shake ? (Math.random() - 0.5) * game.shake : 0;
    view.ox = cx - vw / 2 + shakeX;
    view.oy = cy - vh / 2 + shakeY;
    return { vw, vh };
  }

  function screenToWorld(mx, my) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    return {
      x: view.ox + (mx * dpr) / view.scale,
      y: view.oy + (my * dpr) / view.scale,
    };
  }

  function drawCity(game) {
    const { buildings, trees } = game.city;
    // Grass, sand and sea.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(view.ox - 20, view.oy - 20, view.w / view.scale + 40, view.h / view.scale + 40);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(view.ox - 20, 2420, view.w / view.scale + 40, 140);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(view.ox - 20, 2560, view.w / view.scale + 40, 60);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let x = 0; x < WORLD.width; x += 90) {
      ctx.fillRect(x + ((game.time * 12) % 90), 2578, 44, 3);
    }
    // Palm Park.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(PLACES.park.x - 280, PLACES.park.y - 240, 560, 480);
    // Roads and sidewalks.
    for (const a of AVENUES) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(a - ROAD_W / 2 - 18, 0, ROAD_W + 36, WORLD.height);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(a - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    }
    for (const s of STREETS) {
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(0, s - ROAD_W / 2 - 18, WORLD.width, ROAD_W + 36);
      ctx.fillStyle = PALETTE.road;
      ctx.fillRect(0, s - ROAD_W / 2, WORLD.width, ROAD_W);
    }
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const a of AVENUES) {
      for (let y = 0; y < WORLD.height; y += 64) ctx.fillRect(a - 3, y, 6, 34);
    }
    for (const s of STREETS) {
      for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, s - 3, 34, 6);
    }
    // Buildings.
    for (const b of buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x, b.y, b.w, 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(20,30,50,0.55)';
      const cols = Math.max(2, Math.floor(b.w / 34));
      const rows = Math.max(2, Math.floor(b.h / 34));
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          ctx.fillRect(b.x + 10 + c * 34, b.y + 12 + r * 34, 16, 12);
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(b.x + b.w / 2 - 12, b.y + 8, 24, b.h - 16);
      }
    }
    // Trees.
    for (const t of trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.ellipse(t.x + 3, t.y + 4, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.treeLight;
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Place labels, kept clear of the viewport edges and the HUD band.
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = 'center';
    const vw = view.w / view.scale;
    const vh = view.h / view.scale;
    for (const place of Object.values(PLACES)) {
      if (place.x < view.ox + 90 || place.x > view.ox + vw - 90) continue;
      if (place.y < view.oy + 110 || place.y > view.oy + vh - 40) continue;
      ctx.fillStyle = 'rgba(12,16,24,0.55)';
      const w = ctx.measureText(place.label).width + 14;
      roundRect(ctx, place.x - w / 2, place.y - 52, w, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#f4f1e6';
      ctx.fillText(place.label, place.x, place.y - 37);
    }
  }

  function drawCar(game, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    if (car.marked) {
      ctx.strokeStyle = `rgba(255, 217, 77, ${0.6 + 0.4 * Math.sin(game.time * 6)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 42, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, -26, -14, 52, 28, 8);
    ctx.fill();
    ctx.fillStyle = car.police ? '#eef1f5' : car.color;
    roundRect(ctx, -27, -14, 54, 28, 9);
    ctx.fill();
    if (car.police) {
      ctx.fillStyle = '#222';
      ctx.fillRect(-6, -14, 12, 28);
    }
    ctx.fillStyle = 'rgba(20,40,70,0.75)';
    roundRect(ctx, -8, -11, 16, 22, 4);
    ctx.fill();
    ctx.fillStyle = car.police ? '#1c2733' : 'rgba(255,255,255,0.35)';
    roundRect(ctx, 8, -10, 12, 20, 4);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-24, -17, 10, 5);
    ctx.fillRect(-24, 12, 10, 5);
    ctx.fillRect(14, -17, 10, 5);
    ctx.fillRect(14, 12, 10, 5);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(26, -10, 3, 6);
    ctx.fillRect(26, 4, 3, 6);
    if (car.police) {
      const phase = Math.floor(game.time * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-4, -15, 8, 5);
      ctx.fillStyle = phase ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(-4, 10, 8, 5);
    }
    if (car.kind === 'taxi') {
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(-4, -13, 8, 26);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, opts) {
    const o = opts || {};
    ctx.save();
    ctx.translate(x, y);
    if (o.down) {
      ctx.rotate(angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(17, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(7, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (o.gun) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
    }
    if (o.ring) {
      ctx.strokeStyle = o.ring;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 17, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarker(game, place) {
    if (!place) return;
    const pulse = 0.5 + 0.5 * Math.sin(game.time * 5);
    ctx.fillStyle = `rgba(255, 217, 77, ${0.16 + 0.12 * pulse})`;
    ctx.fillRect(place.x - 8, place.y - 130, 16, 130);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(place.x, place.y, 34 + pulse * 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(place.x, place.y - 34 - pulse * 10);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffd94d';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.restore();
  }

  function drawOffscreenArrow(game, place) {
    if (!place) return;
    const vw = view.w / view.scale;
    const vh = view.h / view.scale;
    const margin = 60;
    if (place.x > view.ox + margin && place.x < view.ox + vw - margin && place.y > view.oy + margin && place.y < view.oy + vh - margin) return;
    const cx = Math.max(view.ox + margin, Math.min(view.ox + vw - margin, place.x));
    const cy = Math.max(view.oy + margin, Math.min(view.oy + vh - margin, place.y));
    const angle = Math.atan2(place.y - cy, place.x - cx);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawMinimap(game) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = MINIMAP.w;
    const h = MINIMAP.h;
    const x = 16;
    const y = view.h / dpr - h - 16;
    const sx = w / WORLD.width;
    const sy = h / WORLD.height;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(12,16,24,0.78)';
    roundRect(ctx, x - 6, y - 6, w + 12, h + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, w, h, 6);
    ctx.clip();
    ctx.fillStyle = '#5d8a4a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#e8d39a';
    ctx.fillRect(x, y + h - 8, w, 8);
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x, y + h - 4, w, 4);
    ctx.strokeStyle = '#3c3f46';
    ctx.lineWidth = 5;
    for (const a of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(x + a * sx, y);
      ctx.lineTo(x + a * sx, y + h);
      ctx.stroke();
    }
    for (const s of STREETS) {
      ctx.beginPath();
      ctx.moveTo(x, y + s * sy);
      ctx.lineTo(x + w, y + s * sy);
      ctx.stroke();
    }
    const place = game.missions.stepPlace();
    if (place) {
      const pulse = 4 + 2 * Math.sin(game.time * 5);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(x + place.x * sx, y + place.y * sy, pulse, 0, Math.PI * 2);
      ctx.fill();
    }
    if (game.markedCar) {
      ctx.fillStyle = '#ffd94d';
      ctx.fillRect(x + game.markedCar.x * sx - 3, y + game.markedCar.y * sy - 3, 6, 6);
    }
    ctx.fillStyle = '#4da3ff';
    for (const car of game.cars) {
      if (car.police) {
        ctx.beginPath();
        ctx.arc(x + car.x * sx, y + car.y * sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#7CFC9a';
    ctx.fillRect(x + PLACES.safehouse.x * sx - 3, y + PLACES.safehouse.y * sy - 3, 6, 6);
    const p = game.player;
    ctx.save();
    ctx.translate(x + p.x * sx, y + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.font = `600 12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f4f1e6';
    ctx.fillText('PALMERA BAY', x + 2, y - 10);
    ctx.restore();
  }

  function drawHud(game, mouse) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = view.w / dpr;
    const ch = view.h / dpr;
    // Money + health, top left.
    ctx.fillStyle = PALETTE.hudBg;
    roundRect(ctx, 16, 14, 220, 64, 10);
    ctx.fill();
    ctx.font = `700 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7CFC9a';
    ctx.fillText(`$${game.money.toLocaleString('en-US')}`, 28, 44);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    roundRect(ctx, 28, 54, 140, 10, 5);
    ctx.fill();
    ctx.fillStyle = game.player.health > 30 ? '#7CFC9a' : '#ff4d4d';
    roundRect(ctx, 28, 54, Math.max(0, 140 * (game.player.health / 100)), 10, 5);
    ctx.fill();
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = '#f4f1e6';
    ctx.fillText(`${Math.ceil(game.player.health)} HP`, 176, 63);
    // Wanted stars, top right.
    for (let i = 0; i < 5; i += 1) star(ctx, cw - 30 - i * 34, 34, 13, i < game.wanted);
    if (game.wanted > 0) {
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffb3b3';
      ctx.fillText(game.wanted >= 3 ? 'POLICE PURSUIT' : 'WANTED', cw - 18, 62);
    }
    // Mission objective, top centre.
    const mission = game.missions.current();
    if (mission) {
      const text = game.missions.objectiveText();
      ctx.font = `600 15px ${FONT}`;
      const w = Math.min(cw - 40, ctx.measureText(text).width + 90);
      ctx.fillStyle = PALETTE.hudBg;
      roundRect(ctx, (cw - w) / 2, 14, w, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.textAlign = 'center';
      ctx.fillText(`◆ ${mission.title}: ${text}`, cw / 2, 36);
    } else if (!game.storyDone) {
      ctx.font = `600 14px ${FONT}`;
      ctx.fillStyle = 'rgba(244,241,230,0.85)';
      ctx.textAlign = 'center';
      ctx.fillText('Next job from Rico coming up — free roam meanwhile', cw / 2, 32);
    }
    // Banner.
    if (game.banner) {
      const alpha = Math.min(1, game.bannerTimer);
      ctx.globalAlpha = alpha;
      ctx.font = `800 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      const bw = ctx.measureText(game.banner.text).width + 40;
      roundRect(ctx, (cw - bw) / 2, 92, bw, 52, 12);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(game.banner.text, cw / 2, 128);
      if (game.banner.sub) {
        ctx.font = `500 15px ${FONT}`;
        ctx.fillStyle = '#f4f1e6';
        ctx.fillText(game.banner.sub, cw / 2, 152);
      }
      ctx.globalAlpha = 1;
    }
    // Speed + prompt, bottom right / centre.
    if (game.player.inCar && game.player.car) {
      const mph = Math.round(Math.abs(game.player.car.speed) * 0.12);
      ctx.font = `800 30px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#f4f1e6';
      ctx.fillText(`${mph}`, cw - 52, ch - 44);
      ctx.font = `600 12px ${FONT}`;
      ctx.fillText('MPH', cw - 20, ch - 44);
      ctx.fillText('E — exit car', cw - 20, ch - 24);
    } else {
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(244,241,230,0.8)';
      ctx.fillText('WASD move · Shift sprint · E enter car · Click shoot · M mute · Q save', cw - 18, ch - 24);
    }
    if (game.prompt) {
      ctx.font = `600 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(game.prompt, cw / 2, ch - 60);
    }
    // Crosshair on foot.
    if (!game.player.inCar && mouse) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mouse.x - 15, mouse.y);
      ctx.lineTo(mouse.x - 6, mouse.y);
      ctx.moveTo(mouse.x + 6, mouse.y);
      ctx.lineTo(mouse.x + 15, mouse.y);
      ctx.moveTo(mouse.x, mouse.y - 15);
      ctx.lineTo(mouse.x, mouse.y - 6);
      ctx.moveTo(mouse.x, mouse.y + 6);
      ctx.lineTo(mouse.x, mouse.y + 15);
      ctx.stroke();
    }
    drawMinimap(game);
    // Hurt vignette: full strength while badly hurt, fading as the sting wears off.
    const hurt = game.player.health < 30 ? 0.35 : Math.min(0.35, Math.max(0, game.player.hurtTimer) * 0.18);
    if (hurt > 0.01) {
      const grad = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.32, cw / 2, ch / 2, ch * 0.75);
      grad.addColorStop(0, 'rgba(255,0,0,0)');
      grad.addColorStop(1, `rgba(255,0,0,${hurt})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.restore();
  }

  function drawMenu(game, screen, menu) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cw = view.w / dpr;
    const ch = view.h / dpr;
    ctx.fillStyle = 'rgba(8, 12, 22, 0.62)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.textAlign = 'center';
    if (screen === SCREEN_TITLE) {
      ctx.font = `800 64px ${FONT}`;
      ctx.fillStyle = '#ffd94d';
      ctx.fillText('PALMERA BAY', cw / 2, ch * 0.26);
      ctx.font = `600 20px ${FONT}`;
      ctx.fillStyle = '#f4f1e6';
      ctx.fillText('An open-world crime story — steal cars, outrun the cops, pull the big score.', cw / 2, ch * 0.26 + 36);
      ctx.font = `500 14px ${FONT}`;
      ctx.fillStyle = 'rgba(244,241,230,0.75)';
      ctx.fillText('A completely original city. No Rockstar names, art or music — everything here was drawn and', cw / 2, ch * 0.26 + 62);
      ctx.fillText('synthesized for this game.', cw / 2, ch * 0.26 + 82);
    } else if (screen === SCREEN_BUSTED) {
      ctx.font = `800 56px ${FONT}`;
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('BUSTED', cw / 2, ch * 0.3);
      ctx.font = `500 18px ${FONT}`;
      ctx.fillStyle = '#f4f1e6';
      ctx.fillText(`The Palmera Bay PD took you in. Fine: $${MONEY_FINE_BUSTED}. Your heat is gone — for now.`, cw / 2, ch * 0.3 + 34);
    } else if (screen === SCREEN_WASTED) {
      ctx.font = `800 56px ${FONT}`;
      ctx.fillStyle = '#ff6b6b';
      ctx.fillText('WASTED', cw / 2, ch * 0.3);
      ctx.font = `500 18px ${FONT}`;
      ctx.fillStyle = '#f4f1e6';
      ctx.fillText(`Milo woke up at St. Marina Hospital, $${MONEY_FINE_WASTED} lighter.`, cw / 2, ch * 0.3 + 34);
    } else if (screen === SCREEN_PAUSED) {
      ctx.font = `800 44px ${FONT}`;
      ctx.fillStyle = '#f4f1e6';
      ctx.fillText('PAUSED', cw / 2, ch * 0.22);
      ctx.font = `500 16px ${FONT}`;
      ctx.fillStyle = 'rgba(244,241,230,0.85)';
      const done = game.save.missionsDone.length;
      ctx.fillText(`Cash $${game.money.toLocaleString('en-US')} · Jobs done ${done}/${MISSIONS.length} · Cars stolen ${game.save.carsStolen} · Busted ${game.save.bustedCount}x`, cw / 2, ch * 0.22 + 30);
    }
    // Menu items.
    if (menu && menu.items.length > 0) {
      ctx.font = `600 22px ${FONT}`;
      menu.items.forEach((item, i) => {
        const y = ch * 0.48 + i * 46;
        const selected = i === menu.index;
        if (selected) {
          ctx.fillStyle = 'rgba(255, 217, 77, 0.18)';
          const w = ctx.measureText(item.label).width + 48;
          roundRect(ctx, (cw - w) / 2, y - 28, w, 40, 12);
          ctx.fill();
          ctx.fillStyle = '#ffd94d';
        } else {
          ctx.fillStyle = '#f4f1e6';
        }
        ctx.fillText(item.label, cw / 2, y);
        menu.hitboxes[i] = { x: cw / 2 - 220, y: y - 30, w: 440, h: 42 };
      });
    }
    if (screen === SCREEN_HELP) {
      ctx.font = `600 18px ${FONT}`;
      ctx.fillStyle = '#f4f1e6';
      const lines = [
        'WASD / Arrows — move or drive',
        'Shift — sprint',
        'E — steal / enter / exit a car',
        'Mouse — aim · Click / Space — shoot (on foot)',
        'Space — brake (in a car)',
        'M — mute music & sound · Q — save · Esc — pause',
        'Steal cars, mind the wanted stars, and follow the yellow marker.',
        'Spray Shop repaints your ride and clears the heat — for a price.',
      ];
      lines.forEach((line, i) => ctx.fillText(line, cw / 2, ch * 0.3 + i * 32));
    } else if (screen === SCREEN_TITLE) {
      ctx.font = `500 14px ${FONT}`;
      ctx.fillStyle = 'rgba(244,241,230,0.7)';
      ctx.fillText('WASD move · E steal a car · Mouse aim, click to shoot · M mute · Q save', cw / 2, ch - 28);
    }
    ctx.restore();
  }

  return {
    screenToWorld,
    draw(game, screen, menu, mouse) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#0b0e14';
      ctx.fillRect(0, 0, view.w, view.h);
      const { vw, vh } = cameraTransform(game);
      ctx.setTransform(view.scale, 0, 0, view.scale, -view.ox * view.scale, -view.oy * view.scale);
      drawCity(game);
      // Skid marks.
      ctx.strokeStyle = 'rgba(20,20,24,0.5)';
      ctx.lineWidth = 5;
      for (const s of game.skids) {
        ctx.globalAlpha = Math.min(0.6, s.life / 4);
        ctx.beginPath();
        ctx.moveTo(s.x - Math.cos(s.angle) * 12, s.y - Math.sin(s.angle) * 12);
        ctx.lineTo(s.x + Math.cos(s.angle) * 12, s.y + Math.sin(s.angle) * 12);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // Pickups.
      for (const pickup of game.pickups) {
        if (pickup.timer > 0) continue;
        const bob = Math.sin(pickup.bob * 3) * 2;
        if (pickup.kind === 'cash') {
          ctx.fillStyle = '#2f9e44';
          ctx.beginPath();
          ctx.arc(pickup.x, pickup.y + bob, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = `700 14px ${FONT}`;
          ctx.textAlign = 'center';
          ctx.fillText('$', pickup.x, pickup.y + bob + 5);
        } else {
          ctx.fillStyle = '#e8e8e8';
          ctx.beginPath();
          ctx.arc(pickup.x, pickup.y + bob, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#d43d3d';
          ctx.fillRect(pickup.x - 7, pickup.y + bob - 2, 14, 4);
          ctx.fillRect(pickup.x - 2, pickup.y + bob - 7, 4, 14);
        }
      }
      // Mission marker + off-screen arrow.
      const place = game.missions.stepPlace();
      drawMarker(game, place);
      for (const car of game.cars) drawCar(game, car);
      for (const ped of game.peds) {
        drawPerson(ped.x, ped.y, ped.angle, ped.color, { down: ped.state === 'down' });
      }
      for (const cop of game.cops) {
        drawPerson(cop.x, cop.y, Math.atan2(game.player.y - cop.y, game.player.x - cop.x), '#2b6cb0', { gun: true });
      }
      for (const rival of game.rivals) {
        drawPerson(rival.x, rival.y, Math.atan2(game.player.y - rival.y, game.player.x - rival.x), '#5b2d8e', { gun: true, ring: '#ff4d4d' });
      }
      // The player, always on top.
      const p = game.player;
      if (p.inCar) {
        // The player car is already drawn with the traffic; ring it so it reads.
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 34, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        drawPerson(p.x, p.y, p.aimAngle, '#e23b3b', { gun: true, ring: '#fff' });
      }
      // Bullets.
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 3;
      for (const b of game.combat.bullets) {
        ctx.beginPath();
        ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // Particles.
      for (const pt of game.combat.particles) {
        ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Floating score text.
      ctx.font = `700 16px ${FONT}`;
      ctx.textAlign = 'center';
      for (const f of game.combat.floaters) {
        ctx.globalAlpha = Math.min(1, f.life);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;
      drawOffscreenArrow(game, place);
      // Sun-soaked wash.
      const grad = ctx.createLinearGradient(view.ox, view.oy, view.ox, view.oy + vh);
      grad.addColorStop(0, 'rgba(255, 214, 130, 0.10)');
      grad.addColorStop(1, 'rgba(255, 214, 130, 0.02)');
      ctx.fillStyle = grad;
      ctx.fillRect(view.ox, view.oy, vw, vh);
      if (screen === SCREEN_PLAY) drawHud(game, mouse);
      else drawMenu(game, screen, menu);
    },
  };
}

// Fines shown on the busted / wasted screens (kept here so the renderer and
// the main loop agree on the numbers).
export const MONEY_FINE_BUSTED = 250;
export const MONEY_FINE_WASTED = 200;
