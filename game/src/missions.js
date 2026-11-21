// The story of Palmera Bay: six jobs from Milo Crane's fixer, Rico, that
// chain into the Palmera Score. Each mission is data — a list of steps —
// and the runner below is the little state machine that walks them.
// Steps: goto, driveTo, stealCar, stealMarked, bringCar, deliver, loseWanted,
// kill, hold, escape.

import { PLACES } from './city.js';

export const MISSIONS = [
  {
    id: 'wheels',
    title: 'Wheels Up',
    giver: 'Rico',
    briefing: 'You are back in Palmera Bay with $150 and no ride. Jack any car and bring it to the Docks. Rico is waiting.',
    reward: 300,
    steps: [
      { kind: 'stealCar', text: 'Steal a car — walk up to one and press E' },
      { kind: 'driveTo', place: 'docks', text: 'Drive to the Docks' },
    ],
  },
  {
    id: 'package',
    title: 'Hot Package',
    giver: 'Rico',
    briefing: 'A courier bailed. Grab the package at the Marina and run it to The Pelican Bar. Ninety seconds. No excuses.',
    reward: 500,
    steps: [
      { kind: 'goto', place: 'marina', text: 'Pick up the package at the Marina' },
      { kind: 'deliver', place: 'bar', seconds: 90, text: 'Deliver the package to The Pelican Bar' },
    ],
  },
  {
    id: 'heat',
    title: 'Heat Check',
    giver: 'Rico',
    briefing: 'The marked coupe at the Marina is hot — the moment you take it, the cops are on you. Shake a 2-star wanted level, then lay low.',
    reward: 600,
    steps: [
      { kind: 'stealMarked', place: 'marina', text: 'Steal the marked coupe at the Marina' },
      { kind: 'loseWanted', text: 'Lose the heat — get your wanted level to zero' },
    ],
  },
  {
    id: 'repo',
    title: 'Repo Run',
    giver: 'Rico',
    briefing: 'A client stopped paying for his sports car. Lift it from the Warehouse Yard and park it in my garage. Try not to scratch it.',
    reward: 800,
    steps: [
      { kind: 'stealMarked', place: 'warehouse', text: 'Steal the sports car at the Warehouse Yard' },
      { kind: 'bringCar', place: 'garage', text: 'Bring the car to Rico\u2019s Garage' },
    ],
  },
  {
    id: 'sweep',
    title: 'Street Sweep',
    giver: 'Rico',
    briefing: 'The Vipers moved into the Warehouse Yard and they are taxing every driver in the Bay. Clear all five of them out.',
    reward: 1000,
    steps: [
      { kind: 'goto', place: 'warehouse', text: 'Get to the Warehouse Yard' },
      { kind: 'kill', count: 5, place: 'warehouse', text: 'Take out the Vipers (0/5)' },
    ],
  },
  {
    id: 'score',
    title: 'The Palmera Score',
    giver: 'Rico',
    briefing: 'Harbor Bank. One vault, one crew of two, and the whole Bay watching. Grab the cash, then run — the safehouse is the only quiet place left.',
    reward: 2500,
    steps: [
      { kind: 'goto', place: 'bank', text: 'Get to Harbor Bank' },
      { kind: 'hold', place: 'bank', seconds: 6, radius: 90, text: 'Hold E at the vault — grab the cash' },
      { kind: 'escape', place: 'safehouse', text: 'Escape to the Safehouse' },
    ],
  },
];

export function createMissionRunner(events) {
  let activeIndex = -1;
  let stepIndex = 0;
  let timeLeft = 0;
  let holdTime = 0;
  let kills = 0;
  let heatSeen = false;
  let markedCarId = null;
  let failed = false;

  function current() {
    return activeIndex >= 0 ? MISSIONS[activeIndex] : null;
  }
  function step() {
    const m = current();
    return m ? m.steps[stepIndex] : null;
  }
  function stepPlace() {
    const s = step();
    return s && s.place ? PLACES[s.place] : null;
  }

  function start(index, game) {
    activeIndex = index;
    stepIndex = 0;
    kills = 0;
    heatSeen = false;
    markedCarId = null;
    failed = false;
    timeLeft = 0;
    holdTime = 0;
    const m = current();
    const s = step();
    if (s && (s.kind === 'stealMarked')) markedCarId = game.spawnMarkedCar(s.place, m.id);
    if (s && s.kind === 'kill') game.spawnRivals(s.place, s.count);
    events.onMissionStart(m);
  }

  function advance(game) {
    stepIndex += 1;
    const m = current();
    if (stepIndex >= m.steps.length) {
      events.onMissionComplete(m);
      activeIndex = -1;
      stepIndex = 0;
      return;
    }
    const s = step();
    timeLeft = s.seconds || 0;
    holdTime = 0;
    if (s.kind === 'stealMarked') markedCarId = game.spawnMarkedCar(s.place, m.id);
    if (s.kind === 'kill') game.spawnRivals(s.place, s.count);
    events.onObjective(s);
  }

  function fail(game) {
    failed = true;
    events.onMissionFailed(current());
    activeIndex = -1;
    stepIndex = 0;
    game.clearMarkedCar();
  }

  function distanceToPlace(game, placeKey) {
    const p = PLACES[placeKey];
    const dx = game.player.x - p.x;
    const dy = game.player.y - p.y;
    return Math.hypot(dx, dy);
  }

  return {
    get activeIndex() {
      return activeIndex;
    },
    get stepIndex() {
      return stepIndex;
    },
    get timeLeft() {
      return timeLeft;
    },
    get holdTime() {
      return holdTime;
    },
    get kills() {
      return kills;
    },
    get markedCarId() {
      return markedCarId;
    },
    get failed() {
      return failed;
    },
    current,
    step,
    stepPlace,
    isActive() {
      return activeIndex >= 0;
    },
    start,
    objectiveText() {
      const s = step();
      if (!s) return '';
      if (s.kind === 'kill') return `Take out the Vipers (${kills}/${s.count})`;
      if (s.kind === 'deliver') return `${s.text} — ${Math.ceil(timeLeft)}s`;
      if (s.kind === 'hold') return `${s.text} — ${Math.ceil(s.seconds - holdTime)}s`;
      return s.text;
    },
    notifyStolen(car) {
      const s = step();
      if (!s) return;
      if (s.kind === 'stealCar') advance(this.game);
      else if (s.kind === 'stealMarked' && car && car.id === markedCarId) advance(this.game);
    },
    notifyKill(kind) {
      const s = step();
      if (!s || s.kind !== 'kill') return;
      if (kind === 'rival') {
        kills += 1;
        if (kills >= s.count) advance(this.game);
      }
    },
    setGame(game) {
      this.game = game;
    },
    update(dt, game) {
      const s = step();
      if (!s) return;
      if (s.kind === 'goto' || s.kind === 'driveTo' || s.kind === 'escape') {
        const radius = s.kind === 'driveTo' ? 130 : 110;
        if (distanceToPlace(game, s.place) < radius) {
          if (s.kind === 'driveTo' && !game.player.inCar) return;
          advance(game);
        }
      } else if (s.kind === 'deliver') {
        timeLeft -= dt;
        if (timeLeft <= 0) {
          fail(game);
          return;
        }
        if (distanceToPlace(game, s.place) < 110) advance(game);
      } else if (s.kind === 'loseWanted') {
        if (game.wanted >= 2) heatSeen = true;
        if (heatSeen && game.wanted === 0) advance(game);
      } else if (s.kind === 'bringCar') {
        if (game.player.inCar && game.player.car && game.player.car.id === markedCarId && distanceToPlace(game, s.place) < 140) {
          advance(game);
        }
      } else if (s.kind === 'hold') {
        if (distanceToPlace(game, s.place) < (s.radius || 90)) {
          holdTime += dt;
          if (holdTime >= s.seconds) advance(game);
        } else {
          holdTime = Math.max(0, holdTime - dt * 2);
        }
      }
    },
  };
}
