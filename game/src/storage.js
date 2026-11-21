// Saves live in localStorage: cash, health, jobs finished, the player's
// spot on the map, and the seed that built this city.
import { CFG } from './settings.js';

export function saveGame(G) {
  const p = G.player;
  const data = {
    v: 2,
    seed: G.seed,
    money: p.money,
    hp: p.hp,
    x: p.x,
    y: p.y,
    missionsDone: G.missionsDone,
    nextMission: G.mission.active ? G.mission.index : nextIndex(G),
    carsStolen: G.stats.carsStolen,
    rivalsDown: G.stats.rivalsDown,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(CFG.saveKey, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(CFG.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 2) return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(CFG.saveKey); } catch { /* storage unavailable */ }
}

function nextIndex(G) {
  for (let i = 0; i < 6; i++) if (!G.missionsDone.includes(i)) return i;
  return 6;
}

export function applySave(G, data) {
  const p = G.player;
  p.money = data.money;
  p.hp = data.hp;
  p.x = data.x;
  p.y = data.y;
  G.missionsDone = data.missionsDone || [];
  G.stats.carsStolen = data.carsStolen || 0;
  G.stats.rivalsDown = data.rivalsDown || 0;
  return data.nextMission;
}
