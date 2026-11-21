// All sound is synthesized with WebAudio: no audio files. A tiny step
// sequencer plays a bass-and-hat groove while driving, and one-shot blips
// cover shots, crashes, pickups and sirens.
export class Synth {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicOn = false;
    this.step = 0;
    this.nextNote = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = 0;
    this.sirenOsc = null;
    this.sirenGain = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.4;
      this.master.connect(this.ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.4;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.15, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ensure() || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.2;
    if (lowpass) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = lowpass;
      src.connect(f); f.connect(g); g.connect(this.master);
    } else {
      src.connect(g); g.connect(this.master);
    }
    src.start(t);
  }

  shot() { this.noise(0.09, 0.28, 3200); this.tone(180, 0.08, 'square', 0.12, 60); }
  rivalShot() { this.noise(0.07, 0.14, 2400); }
  punch() { this.noise(0.06, 0.2, 900); }
  crash() { this.noise(0.28, 0.35, 700); this.tone(90, 0.25, 'sawtooth', 0.16, 40); }
  boom() { this.noise(0.6, 0.5, 420); this.tone(55, 0.5, 'sine', 0.3, 28); }
  coin() { this.tone(880, 0.09, 'sine', 0.16); setTimeout(() => this.tone(1318, 0.14, 'sine', 0.16), 80); }
  heal() { this.tone(520, 0.12, 'sine', 0.14, 780); }
  click() { this.tone(660, 0.05, 'square', 0.08); }
  mission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'triangle', 0.16), i * 110)); }
  fail() { [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sawtooth', 0.1), i * 150)); }
  steal() { this.tone(300, 0.1, 'square', 0.1, 520); }

  // Engine hum that follows the car's speed; call every frame while driving.
  engine(speedFrac) {
    if (!this.ensure() || this.muted) { this.engineStop(); return; }
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 700;
      this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + speedFrac * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speedFrac * 0.05, t, 0.1);
  }

  engineStop() {
    if (this.engineOsc) {
      try { this.engineOsc.stop(); } catch { /* already stopped */ }
      this.engineOsc = null; this.engineGain = null;
    }
  }

  // Two-tone siren that wails while police are close; call every frame.
  siren(active, dt) {
    if (!this.ensure()) return;
    if (!active) {
      if (this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch { /* noop */ }
        this.sirenOsc = null; this.sirenGain = null;
      }
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenTimer = 0;
    }
    this.sirenTimer += dt;
    const phase = (this.sirenTimer % 1.2) / 1.2;
    const freq = phase < 0.5 ? 720 : 540;
    this.sirenOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
  }

  // Looping groove: Am–F–C–G bass roots with hats, scheduled ahead.
  startMusic() {
    if (!this.ensure() || this.musicOn) return;
    this.musicOn = true;
    this.step = 0;
    this.nextNote = this.ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 90);
  }

  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  scheduleMusic() {
    if (!this.musicOn || this.muted) return;
    const roots = [110, 87.31, 130.81, 98];
    while (this.nextNote < this.ctx.currentTime + 0.25) {
      const bar = Math.floor(this.step / 8) % 4;
      const beat = this.step % 8;
      const root = roots[bar];
      if (beat === 0 || beat === 3 || beat === 6) this.musicTone(root, 0.22, 'triangle', 0.16, this.nextNote);
      if (beat === 4) this.musicTone(root * 1.5, 0.18, 'triangle', 0.1, this.nextNote);
      if (beat % 2 === 0) this.musicTone(6000, 0.03, 'square', 0.02, this.nextNote);
      this.nextNote += 0.21;
      this.step++;
    }
  }

  musicTone(freq, dur, type, vol, when) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.001, when + dur);
    o.connect(g); g.connect(this.master);
    o.start(when); o.stop(when + dur + 0.02);
  }
}
