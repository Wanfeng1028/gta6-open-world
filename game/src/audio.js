// Every sound in Palmera Bay is synthesized live with WebAudio: no audio
// files, no network. Engine hum, sirens, gunshots and a small bass-driven
// music loop, all behind one mute toggle.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1800;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.25;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start();
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  // A lazy two-bar bass loop with a hat tick, scheduled a bar ahead.
  const BASS = [55, 0, 55, 0, 65.4, 0, 49, 0, 55, 0, 55, 0, 73.4, 65.4, 58.3, 49];
  function startMusic() {
    if (!ensure() || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted || !ctx || ctx.state === 'suspended') return;
      const note = BASS[musicStep % BASS.length];
      if (note) blip(note, 0.22, 'triangle', 0.16);
      if (musicStep % 2 === 0) noise(0.03, 0.03, 6000);
      musicStep += 1;
    }, 190);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
      startMusic();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    engine(speedRatio, driving) {
      if (!ctx || muted) return;
      engineGain.gain.value = driving ? 0.05 + speedRatio * 0.09 : 0;
      engineOsc.frequency.value = 52 + speedRatio * 130;
    },
    siren(on) {
      if (!ctx || muted) return;
      sirenGain.gain.value = on ? 0.035 : 0;
      if (on) sirenOsc.frequency.value = 660 + 160 * Math.sin(performance.now() / 320);
    },
    gunshot() {
      noise(0.14, 0.3, 2400);
    },
    punch() {
      noise(0.08, 0.18, 900);
    },
    pickup() {
      blip(660, 0.09, 'square', 0.1);
      window.setTimeout(() => blip(990, 0.12, 'square', 0.1), 80);
    },
    crash() {
      noise(0.25, 0.3, 700);
    },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => window.setTimeout(() => blip(f, 0.16, 'square', 0.12), i * 110));
    },
    busted() {
      blip(330, 0.4, 'sawtooth', 0.14, 110);
    },
    click() {
      blip(880, 0.05, 'square', 0.08);
    },
  };
}
