// The HUD and the screens: money and health, wanted stars, the mission
// banner, the minimap, toasts, and the title / help / pause / busted /
// game-over / finale screens. All drawn on the same canvas.
import { CFG } from './settings.js';
import { MISSIONS, missionObjective } from './story.js';
import { roundRect } from './painter.js';
import { clamp } from './dice.js';

function chip(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(12,16,24,0.72)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
}

export function drawHUD(ctx, G) {
  const p = G.player;
  const W = CFG.viewW, H = CFG.viewH;

  // Money + health, top left.
  chip(ctx, 14, 12, 208, 64);
  ctx.fillStyle = '#5ad88c';
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${p.money.toLocaleString('en-US')}`, 28, 40);
  ctx.fillStyle = '#222';
  roundRect(ctx, 28, 50, 150, 10, 5); ctx.fill();
  ctx.fillStyle = p.hp > 35 ? '#5ad88c' : '#ff5040';
  roundRect(ctx, 28, 50, 150 * clamp(p.hp / CFG.playerHp, 0, 1), 10, 5); ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)} HP`, 184, 59);

  // Ammo / car health under the money chip.
  chip(ctx, 14, 84, 208, 30);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 14px system-ui, sans-serif';
  if (p.car) {
    ctx.fillText(`CAR ${Math.max(0, Math.ceil(p.car.hp))}%  ·  ${p.car.model}`, 28, 104);
    ctx.fillStyle = p.car.hp > 35 ? '#e8c84a' : '#ff5040';
    roundRect(ctx, 28, 110, 0, 0, 0);
  } else if (p.reloading > 0) {
    ctx.fillText('RELOADING…', 28, 104);
  } else {
    ctx.fillText(`AMMO ${p.ammo} / ${CFG.clipSize}  ·  R reload`, 28, 104);
  }

  // Wanted stars, top right.
  const stars = G.wantedShown;
  ctx.font = '26px system-ui, sans-serif';
  ctx.textAlign = 'right';
  for (let i = 0; i < CFG.wantedMax; i++) {
    ctx.fillStyle = i < stars ? '#e8c84a' : 'rgba(232,232,232,0.35)';
    ctx.fillText('★', W - 30 - i * 28, 44);
  }
  if (stars > 0) {
    ctx.fillStyle = '#ff5040';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('WANTED', W - 30, 66);
  }

  // Mission banner, top centre.
  const obj = missionObjective(G);
  ctx.font = 'bold 15px system-ui, sans-serif';
  const ow = ctx.measureText(obj).width + 44;
  chip(ctx, (W - ow) / 2, 12, ow, 36);
  ctx.fillStyle = '#e8c84a';
  ctx.textAlign = 'left';
  ctx.fillText('◆', (W - ow) / 2 + 14, 36);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(obj, (W - ow) / 2 + 36, 36);
  const m = G.mission;
  if (m.active && m.timer > 0) {
    ctx.fillStyle = m.timer < 15 ? '#ff5040' : '#ffffff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.ceil(m.timer)}s`, W / 2, 68);
  }

  // Toasts, lower centre.
  ctx.font = '14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  let ty = H - 118;
  for (let i = G.toasts.length - 1; i >= 0; i--) {
    const t = G.toasts[i];
    const tw = ctx.measureText(t.text).width + 28;
    ctx.globalAlpha = clamp(t.t, 0, 1);
    chip(ctx, (W - tw) / 2, ty - 24, tw, 30);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(t.text, W / 2, ty - 4);
    ctx.globalAlpha = 1;
    ty -= 36;
  }

  // Controls hint, bottom right.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · Shift sprint · E enter car · Click shoot · Space punch · R reload · Q save · Esc pause', W - 14, H - 14);

  drawMinimap(ctx, G);
  drawCrosshair(ctx, G);
}

function drawMinimap(ctx, G) {
  const T = G.town;
  const mw = 216, mh = 168, mx = 14, my = CFG.viewH - mh - 14;
  const sx = mw / T.W, sy = mh / T.H;
  chip(ctx, mx - 6, my - 24, mw + 12, mh + 30);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PALMERA BAY', mx, my - 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, mw, mh);
  ctx.clip();
  ctx.fillStyle = '#3f6a3f';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#2e7fa8';
  ctx.fillRect(mx, my + (T.seaY - 0) * sy, mw, mh - T.seaY * sy);
  ctx.fillStyle = '#dcc98c';
  ctx.fillRect(mx, my + T.beachY * sy, mw, (T.seaY - T.beachY) * sy);
  ctx.strokeStyle = '#c9c9c9';
  ctx.lineWidth = 1;
  for (const rx of T.vRoads) {
    ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke();
  }
  for (const ry of T.hRoads) {
    ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke();
  }
  // Mission target blip.
  const m = G.mission;
  if (m.active && m.target) {
    ctx.fillStyle = '#e8c84a';
    ctx.beginPath(); ctx.arc(mx + m.target.x * sx, my + m.target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  // Safehouse blip.
  ctx.fillStyle = '#5ad88c';
  ctx.fillRect(mx + T.markers.safehouse.x * sx - 3, my + T.markers.safehouse.y * sy - 3, 6, 6);
  // Cops.
  ctx.fillStyle = '#4060ff';
  for (const c of G.cops) {
    ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow.
  const p = G.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(7, 0); ctx.lineTo(-5, -4); ctx.lineTo(-5, 4);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawCrosshair(ctx, G) {
  const k = G.keys;
  if (G.player.car || G.screen !== 'play') return;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(k.mouse.x, k.mouse.y, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(k.mouse.x - 13, k.mouse.y); ctx.lineTo(k.mouse.x - 5, k.mouse.y);
  ctx.moveTo(k.mouse.x + 5, k.mouse.y); ctx.lineTo(k.mouse.x + 13, k.mouse.y);
  ctx.moveTo(k.mouse.x, k.mouse.y - 13); ctx.lineTo(k.mouse.x, k.mouse.y - 5);
  ctx.moveTo(k.mouse.x, k.mouse.y + 5); ctx.lineTo(k.mouse.x, k.mouse.y + 13);
  ctx.stroke();
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(8,12,20,0.55)';
  ctx.fillRect(0, 0, CFG.viewW, CFG.viewH);
}

function bigTitle(ctx, text, y, size, color) {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, CFG.viewW / 2, y);
}

function menuLine(ctx, text, y, active) {
  ctx.font = `${active ? 'bold ' : ''}22px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = active ? '#e8c84a' : '#ffffff';
  ctx.fillText((active ? '▸ ' : '') + text, CFG.viewW / 2, y);
}

export function drawTitle(ctx, G, selected) {
  dim(ctx);
  bigTitle(ctx, 'PALMERA BAY', 190, 64, '#e8c84a');
  ctx.font = '19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('An open-world crime story — steal cars, outrun the cops, pull the big score.', CFG.viewW / 2, 232);
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('An original city. No Rockstar names, art or music — everything here was drawn and synthesized for this game.', CFG.viewW / 2, 260);
  const items = G.hasSave
    ? ['Continue', 'New Game', 'How to Play']
    : ['New Game', 'How to Play'];
  items.forEach((it, i) => menuLine(ctx, it, 340 + i * 48, i === selected));
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('WASD move · E steal a car · Mouse aim, click to shoot · M mute · Q save', CFG.viewW / 2, CFG.viewH - 40);
  ctx.fillText(`Jobs done: ${G.missionsDone.length} / ${MISSIONS.length}    Cash: $${G.player.money}`, CFG.viewW / 2, CFG.viewH - 16);
}

export function drawHelp(ctx, G) {
  dim(ctx);
  bigTitle(ctx, 'HOW TO PLAY', 120, 40, '#e8c84a');
  const lines = [
    ['Move', 'WASD or arrow keys — hold Shift to sprint'],
    ['Steal a car', 'Walk up to any car and press E. Parked cars are free; taking a moving car is a crime'],
    ['Drive', 'W to speed up, S to brake and reverse, A / D to steer'],
    ['Fight', 'Mouse to aim, click to shoot, Space to punch, R to reload'],
    ['Wanted level', 'Crimes raise your stars. Cops chase, ram and — at 3 stars — shoot. Hide to cool off'],
    ['Busted', 'A cop standing over you on foot busts you. Getting wasted sends you to the hospital'],
    ['Jobs', 'Press N for the next job from Mara. Follow the gold marker — finish all six for the Palmera Score'],
    ['Save', 'Q saves at any time. Your cash, jobs and position are kept'],
    ['Pause', 'Esc pauses · M mutes the sound'],
  ];
  ctx.textAlign = 'left';
  lines.forEach(([h, b], i) => {
    const y = 180 + i * 44;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.fillStyle = '#e8c84a';
    ctx.fillText(h, 260, y);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b, 460, y);
  });
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Press Esc or Enter to go back', CFG.viewW / 2, CFG.viewH - 48);
}

export function drawPause(ctx, G) {
  dim(ctx);
  bigTitle(ctx, 'PAUSED', 240, 48, '#ffffff');
  ctx.font = '18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('Esc to resume · Q to save · M to mute · H for help', CFG.viewW / 2, 300);
  ctx.fillText(`Cash $${G.player.money} · Jobs done ${G.missionsDone.length} / ${MISSIONS.length}`, CFG.viewW / 2, 336);
}

export function drawBusted(ctx, G) {
  dim(ctx);
  bigTitle(ctx, 'BUSTED', 260, 56, '#4060ff');
  ctx.font = '19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('The Palmera Bay police took you in. Bail cost you $200 — Mara is not happy.', CFG.viewW / 2, 320);
  ctx.fillText('Press Enter to walk out of the station', CFG.viewW / 2, 360);
}

export function drawWasted(ctx, G) {
  dim(ctx);
  bigTitle(ctx, 'WASTED', 260, 56, '#ff5040');
  ctx.font = '19px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('You woke up at the hospital, $150 lighter. The city is still out there.', CFG.viewW / 2, 320);
  ctx.fillText('Press Enter to get back on your feet', CFG.viewW / 2, 360);
}

export function drawDone(ctx, G) {
  dim(ctx);
  bigTitle(ctx, 'THE PALMERA SCORE', 200, 52, '#e8c84a');
  ctx.font = '20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('The van is at the Marina. Mara counts the cash, the Gulls are gone,', CFG.viewW / 2, 260);
  ctx.fillText('and Palmera Bay belongs to Rook now.', CFG.viewW / 2, 290);
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = '#5ad88c';
  ctx.fillText(`Final take: $${G.player.money.toLocaleString('en-US')} · Cars stolen: ${G.stats.carsStolen} · Rivals down: ${G.stats.rivalsDown}`, CFG.viewW / 2, 350);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Press Enter to keep roaming the city', CFG.viewW / 2, 410);
}

export function drawMissionCard(ctx, G) {
  // A short briefing card shown when a job starts.
  const m = G.mission;
  if (!m.active || G.time - (m.startedAt || 0) > 6) return;
  const def = MISSIONS[m.index];
  chip(ctx, 90, 140, CFG.viewW - 180, 96);
  ctx.fillStyle = '#e8c84a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${def.title} — $${def.pay}`, 116, 172);
  ctx.fillStyle = '#ffffff';
  ctx.font = '15px system-ui, sans-serif';
  const words = def.brief.split(' ');
  let line = '', y = 198;
  for (const w of words) {
    if (ctx.measureText(line + w).width > CFG.viewW - 260) {
      ctx.fillText(line, 116, y); y += 20; line = '';
    }
    line += w + ' ';
  }
  ctx.fillText(line, 116, y);
}
