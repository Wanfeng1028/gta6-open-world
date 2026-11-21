// The story: six jobs for Rook, a newcomer in Palmera Bay, handed out by
// Mara Voss, a fixer who runs the safehouse. Each job is a small state
// machine — go somewhere, steal or grab something, survive the heat — and
// the last one is the Palmera Score.
import { CFG } from './settings.js';
import { dist } from './dice.js';
import { addWanted, toast, makeCar, burst } from './actors.js';

export const STORY = {
  fixer: 'Mara Voss',
  hero: 'Rook',
  crew: 'The Gulls',
};

export const MISSIONS = [
  {
    id: 'wheels', title: 'Wheels Up', pay: CFG.missionReward[0],
    brief: 'Mara: "New in town, no wheels? Fix that. Take a car — any car — then bring it to the paint shop so it stops looking stolen."',
    steps: ['Steal a car — walk up to one and press E', 'Drive it to the Paint Shop'],
  },
  {
    id: 'courier', title: 'Courier Run', pay: CFG.missionReward[1],
    brief: 'Mara: "A package is waiting at the Old Dock. Pick it up and run it to the Marina. Ninety seconds. The Gulls are watching the roads."',
    steps: ['Pick up the package at the Old Dock', 'Deliver it to the Marina before time runs out'],
  },
  {
    id: 'neighbors', title: 'Loud Neighbors', pay: CFG.missionReward[2],
    brief: 'Mara: "The Gulls set up in the Yards and they are loud about it. Go make them quiet, then come home."',
    steps: ['Head to the Yards', 'Clear out the Gull crew', 'Get back to the Safehouse'],
  },
  {
    id: 'bank', title: 'The Bay Bank Job', pay: CFG.missionReward[3],
    brief: 'Mara: "The Bay Bank keeps its cash in a back room with a slow lock. Walk in, take it, and do not get caught on the way home."',
    steps: ['Reach the Bay Bank', 'Hold the room — crack the cash box', 'Lose the heat and reach the Safehouse'],
  },
  {
    id: 'getaway', title: 'Getaway Driver', pay: CFG.missionReward[4],
    brief: 'Mara: "Three stops, one route, no excuses. Chapel, Paint Shop, Marina. Be quick — the city is not waiting."',
    steps: ['Get in a car', 'Hit the checkpoints in order'],
  },
  {
    id: 'score', title: 'The Palmera Score', pay: CFG.missionReward[5],
    brief: 'Mara: "One armored van, one Marina handoff, and we are done being small. Take the van from the Yards, shake four stars, bring it home."',
    steps: ['Steal the armored van from the Yards', 'Lose the heat and deliver it to the Marina'],
  },
];

export function spawnRivals(G, x, y, n) {
  for (let i = 0; i < n; i++) {
    G.rivals.push({
      x: x + G.dice.range(-60, 60), y: y + G.dice.range(-60, 60),
      angle: 0, hp: 60, shootCd: G.dice.range(0.3, 1),
    });
  }
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  const m = G.town.markers;
  const p = G.player;
  G.mission = {
    index, step: 0, timer: 0, grabT: 0, active: true,
    target: null, text: def.steps[0], checkpoints: [], cpIndex: 0,
    startedAt: G.time,
  };
  if (def.id === 'courier') { G.mission.target = { ...m.dock }; G.mission.timer = 0; }
  if (def.id === 'neighbors') G.mission.target = { ...m.yard };
  if (def.id === 'bank') G.mission.target = { ...m.bank };
  if (def.id === 'getaway') {
    G.mission.checkpoints = [{ ...m.chapel }, { ...m.paintshop }, { ...m.marina }];
    G.mission.target = G.mission.checkpoints[0];
    G.mission.timer = 75;
  }
  if (def.id === 'score') {
    G.mission.target = { ...m.yard };
    const van = makeCar(G.dice, m.yard.x + 40, m.yard.y + 40, true, true);
    van.body = '#23232e'; van.model = 'Armadillo'; van.top = 300; van.len = 68; van.wid = 30;
    van.parked = true; van.traffic = false;
    G.cars.push(van);
    G.mission.van = van;
  }
  if (def.id === 'wheels') G.mission.target = { ...m.paintshop };
  toast(G, `New job: ${def.title} — $${def.pay}`);
  G.synth.mission();
  return true;
}

export function missionObjective(G) {
  const m = G.mission;
  if (!m.active) return G.missionsDone.length >= MISSIONS.length
    ? 'All jobs done — Palmera Bay is yours'
    : 'Free roam — press N for the next job';
  const def = MISSIONS[m.index];
  return `${def.title}: ${def.steps[Math.min(m.step, def.steps.length - 1)]}`;
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m.active) return;
  const def = MISSIONS[m.index];
  const p = G.player;
  const t = G.town.markers;
  const near = (pt, r) => pt && dist(p.x, p.y, pt.x, pt.y) < (r || 64);

  if (def.id === 'wheels') {
    if (m.step === 0 && p.car) { m.step = 1; m.text = def.steps[1]; toast(G, 'Now lose the plates — Paint Shop'); }
    else if (m.step === 1 && near(m.target, 70)) completeMission(G);
  } else if (def.id === 'courier') {
    if (m.step === 0 && near(m.target, 60)) {
      m.step = 1; m.target = { ...t.marina }; m.timer = 90;
      toast(G, 'Package grabbed — 90 seconds to the Marina!');
    } else if (m.step === 1) {
      m.timer -= dt;
      if (near(m.target, 70)) completeMission(G);
      else if (m.timer <= 0) failMission(G, 'The package went cold — too slow');
    }
  } else if (def.id === 'neighbors') {
    if (m.step === 0 && near(m.target, 90)) {
      m.step = 1;
      spawnRivals(G, t.yard.x, t.yard.y, 4);
      addWanted(G, 1);
      toast(G, 'The Gulls are here — clear them out');
    } else if (m.step === 1 && G.rivals.every((r) => r.hp <= 0)) {
      m.step = 2; m.target = { ...t.safehouse };
      toast(G, 'Yards are quiet — get home');
    } else if (m.step === 2 && near(m.target, 70)) completeMission(G);
  } else if (def.id === 'bank') {
    if (m.step === 0 && near(m.target, 60)) {
      m.step = 1; m.grabT = 0;
      toast(G, 'Cracking the cash box — hold the room!');
      spawnRivals(G, t.bank.x, t.bank.y, 2);
    } else if (m.step === 1) {
      m.grabT += dt;
      if (m.grabT > 4) {
        m.step = 2; m.target = { ...t.safehouse };
        addWanted(G, 3);
        toast(G, 'Cash grabbed — the whole city is coming. Run!');
      }
    } else if (m.step === 2 && near(m.target, 70)) {
      G.wanted = 0; G.wantedShown = 0; G.cops.length = 0;
      completeMission(G);
    }
  } else if (def.id === 'getaway') {
    if (m.step === 0 && p.car) {
      m.step = 1;
      toast(G, 'Clock is running — three stops!');
    } else if (m.step === 1) {
      m.timer -= dt;
      if (near(m.target, 70)) {
        m.cpIndex++;
        G.synth.coin();
        if (m.cpIndex >= m.checkpoints.length) { completeMission(G); return; }
        m.target = m.checkpoints[m.cpIndex];
        toast(G, `Checkpoint ${m.cpIndex + 1} of 3`);
      } else if (m.timer <= 0) failMission(G, 'Out of time on the getaway route');
    }
  } else if (def.id === 'score') {
    if (m.step === 0 && p.car === m.van) {
      m.step = 1; m.target = { ...t.marina };
      addWanted(G, 4);
      spawnRivals(G, t.yard.x, t.yard.y, 2);
      toast(G, 'The van is yours — shake the heat, then the Marina');
    } else if (m.step === 1 && near(m.target, 80) && G.wanted <= 1) {
      completeMission(G);
    }
  }
}

export function completeMission(G) {
  const m = G.mission;
  const def = MISSIONS[m.index];
  G.player.money += def.pay;
  G.missionsDone.push(def.id);
  G.synth.mission();
  burst(G, G.player.x, G.player.y, '#e8c84a', 24);
  toast(G, `${def.title} complete — +$${def.pay}`);
  m.active = false;
  if (G.missionsDone.length >= MISSIONS.length) {
    G.screen = 'done';
    return;
  }
  toast(G, 'Press N for the next job');
}

export function failMission(G, why) {
  G.mission.active = false;
  G.synth.fail();
  toast(G, `${why} — press N to try again`);
}
