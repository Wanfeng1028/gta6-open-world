// Save games live in localStorage only: money, mission progress, the story
// state and the player's best run. Loading never trusts the file: anything
// missing or out of range falls back to a fresh start.

import { SAVE_KEY, MONEY } from './config.js';

export function defaultSave() {
  return {
    money: MONEY.start,
    missionsDone: [],
    storyDone: false,
    carsStolen: 0,
    bustedCount: 0,
    bestCash: 0,
    playSeconds: 0,
  };
}

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const save = defaultSave();
    if (Number.isFinite(data.money)) save.money = Math.max(0, Math.min(999999, Math.floor(data.money)));
    if (Array.isArray(data.missionsDone)) save.missionsDone = data.missionsDone.filter((m) => typeof m === 'string');
    save.storyDone = data.storyDone === true;
    if (Number.isFinite(data.carsStolen)) save.carsStolen = Math.max(0, Math.floor(data.carsStolen));
    if (Number.isFinite(data.bustedCount)) save.bustedCount = Math.max(0, Math.floor(data.bustedCount));
    if (Number.isFinite(data.bestCash)) save.bestCash = Math.max(0, Math.floor(data.bestCash));
    if (Number.isFinite(data.playSeconds)) save.playSeconds = Math.max(0, Math.floor(data.playSeconds));
    return save;
  } catch {
    return null;
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}
