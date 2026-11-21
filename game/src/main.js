// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between title, play, paused, help, busted and wasted screens.
//
// ?seed=N fixes the city. ?shot=cover|drive|mission|street (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createGame } from './world.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_MUTE, ACTION_SAVE } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_WASTED, SCREEN_HELP, MONEY_FINE_BUSTED, MONEY_FINE_WASTED } from './render.js';
import { readSave, writeSave, clearSave, defaultSave } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function announce(message) {
  status.textContent = message;
}

function makeGame(save) {
  const game = createGame(seed, save || defaultSave());
  game.audio = audio;
  return game;
}

function runShot(name) {
  const game = makeGame(defaultSave());
  window.__palmera = {
    game,
    screen: () => 'play',
    state() {
      return {
        screen: 'play',
        wanted: game.wanted,
        money: game.money,
        health: Math.round(game.player.health),
        inCar: game.player.inCar,
        mission: game.missions.current() ? game.missions.current().id : null,
        objective: game.missions.objectiveText(),
        cars: game.cars.length,
        peds: game.peds.length,
        cops: game.cops.length,
        rivals: game.rivals.length,
        x: Math.round(game.player.x),
        y: Math.round(game.player.y),
      };
    },
  };
  const screen = stageShot(name, game);
  let painted = 0;
  function paint() {
    renderer.draw(game, screen, null, null);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let save = readSave();
  let game = makeGame(save);
  let screen = SCREEN_TITLE;
  let returnScreen = SCREEN_TITLE;
  let menu = { items: [], index: 0, hitboxes: [] };
  let navCooldown = 0;
  let accumulator = 0;
  let last = performance.now();

  function titleMenu() {
    const items = [];
    if (readSave()) items.push({ label: 'Continue', action: 'continue' });
    items.push({ label: 'New Game', action: 'new' });
    items.push({ label: 'How to Play', action: 'help' });
    return { items, index: 0, hitboxes: [] };
  }

  function pauseMenu() {
    return {
      items: [
        { label: 'Resume', action: 'resume' },
        { label: 'Save Game', action: 'save' },
        { label: 'How to Play', action: 'help' },
        { label: 'Quit to Title', action: 'quit' },
      ],
      index: 0,
      hitboxes: [],
    };
  }

  function helpMenu() {
    return { items: [{ label: 'Back', action: 'back' }], index: 0, hitboxes: [] };
  }

  function overMenu() {
    return { items: [{ label: 'Keep Playing', action: 'resume' }], index: 0, hitboxes: [] };
  }

  function syncSave() {
    game.save.money = game.money;
    game.save.playSeconds = Math.floor(game.time);
  }

  function saveGame() {
    syncSave();
    if (writeSave(game.save)) {
      game.banner = { text: 'Game saved', sub: '' };
      game.bannerTimer = 2;
      announce('Game saved.');
    }
  }

  function startNewGame() {
    clearSave();
    game = makeGame(defaultSave());
    game.newGame();
    screen = SCREEN_PLAY;
    announce('New game. Rico has a job for you: steal a car and bring it to the Docks.');
  }

  function continueGame() {
    const loaded = readSave();
    game = makeGame(loaded || defaultSave());
    // Pick the story back up: the next unfinished job starts shortly.
    if (!game.storyDone) game.nextMissionAt = 2;
    screen = SCREEN_PLAY;
    announce('Welcome back to Palmera Bay.');
  }

  function applyMenuAction(action) {
    audio.unlock();
    audio.click();
    if (action === 'new') startNewGame();
    else if (action === 'continue') continueGame();
    else if (action === 'resume') {
      if (screen === SCREEN_BUSTED) {
        game.money = Math.max(0, game.money - MONEY_FINE_BUSTED);
        game.save.bustedCount += 1;
        game.respawn('hospital');
      } else if (screen === SCREEN_WASTED) {
        game.money = Math.max(0, game.money - MONEY_FINE_WASTED);
        game.respawn('safehouse');
      }
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (action === 'save') {
      saveGame();
    } else if (action === 'help') {
      returnScreen = screen;
      screen = SCREEN_HELP;
      menu = helpMenu();
    } else if (action === 'back') {
      screen = returnScreen;
      menu = screen === SCREEN_PAUSED ? pauseMenu() : titleMenu();
    } else if (action === 'quit') {
      syncSave();
      writeSave(game.save);
      game = makeGame(readSave());
      screen = SCREEN_TITLE;
      menu = titleMenu();
    }
  }

  function setScreen(next) {
    screen = next;
    if (next === SCREEN_TITLE) menu = titleMenu();
    else if (next === SCREEN_PAUSED) menu = pauseMenu();
    else if (next === SCREEN_BUSTED || next === SCREEN_WASTED) menu = overMenu();
  }

  setScreen(SCREEN_TITLE);

  // Live state for automated play-testing (and curious players).
  window.__palmera = {
    get game() {
      return game;
    },
    get screen() {
      return screen;
    },
    state() {
      return {
        screen,
        wanted: game.wanted,
        money: game.money,
        health: Math.round(game.player.health),
        inCar: game.player.inCar,
        mission: game.missions.current() ? game.missions.current().id : null,
        objective: game.missions.objectiveText(),
        cars: game.cars.length,
        peds: game.peds.length,
        cops: game.cops.length,
        rivals: game.rivals.length,
        x: Math.round(game.player.x),
        y: Math.round(game.player.y),
      };
    },
  };

  function handleMenuInput(dt) {
    navCooldown -= dt;
    const dir = input.direction();
    if (dir.y < 0 && navCooldown <= 0 && menu.items.length > 1) {
      menu.index = (menu.index - 1 + menu.items.length) % menu.items.length;
      navCooldown = 0.18;
      audio.click();
    } else if (dir.y > 0 && navCooldown <= 0 && menu.items.length > 1) {
      menu.index = (menu.index + 1) % menu.items.length;
      navCooldown = 0.18;
      audio.click();
    }
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      // A click on an item picks it; Enter/Space picks the highlighted one.
      const mouse = input.mouse;
      let picked = menu.index;
      menu.hitboxes.forEach((box, i) => {
        if (box && mouse.x >= box.x && mouse.x <= box.x + box.w && mouse.y >= box.y && mouse.y <= box.y + box.h) picked = i;
      });
      menu.index = picked;
      applyMenuAction(menu.items[picked].action);
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function handlePlayInput() {
    const actions = input.takeActions();
    if (actions & ACTION_PAUSE) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    } else if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    } else if (actions & ACTION_SAVE) {
      saveGame();
    }
    return actions;
  }

  function aimAngle() {
    const world = renderer.screenToWorld(input.mouse.x, input.mouse.y);
    return Math.atan2(world.y - game.player.y, world.x - game.player.x);
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the city lives behind the title.
      const idle = { direction: () => ({ x: 0, y: 0 }), sprint: () => false, shooting: () => false };
      game.step(STEP, idle, 0, { enter: false });
      return;
    }
    const actions = handlePlayInput();
    game.step(STEP, input, aimAngle(), { enter: !!(actions & ACTION_ENTER) });
    if (game.busted) {
      setScreen(SCREEN_BUSTED);
      announce('Busted. The police took you in.');
    } else if (game.wasted) {
      setScreen(SCREEN_WASTED);
      announce('Wasted. You woke up in hospital.');
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    if (screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE) {
      handleMenuInput(dt);
      accumulator += dt;
      while (accumulator >= STEP && screen === SCREEN_TITLE) {
        step();
        accumulator -= STEP;
      }
    } else {
      handleMenuInput(dt);
      accumulator = 0;
    }
    renderer.draw(game, screen, menu, input.mouse);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      setScreen(SCREEN_PAUSED);
      announce('Paused.');
    }
  });

  announce('Palmera Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
