/**
 * Mission Architect — SoundManager (Web Audio, fully synthesized, no audio files).
 * Every control has a distinct sound (Part 8) plus ambient/cinematic cues (Part 10).
 * Resume on first user gesture; mute + master volume from settings.
 */
export type SoundName =
  | 'key' | 'keyHover' | 'warp' | 'fire' | 'com' | 'scan' | 'shldOn' | 'shldOff'
  | 'error' | 'attach' | 'confirm' | 'back' | 'beep' | 'alarm' | 'tick' | 'rumble'
  | 'drone' | 'storm' | 'static' | 'success' | 'failure' | 'lockOpen';

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fxGain: GainNode | null = null;
  private ambGain: GainNode | null = null;
  private droneNodes: { osc: OscillatorNode; gain: GainNode } | null = null;
  private rumbleNodes: { src: AudioBufferSourceNode; gain: GainNode; filter: BiquadFilterNode } | null = null;
  private bufferCache: AudioBuffer | null = null;
  muted = false;
  volume = 0.6;
  effectsVolume = 0.85;
  ambienceVolume = 0.65;

  /** Must be called from a user gesture (click/keydown) to satisfy autoplay policy. */
  resume() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.master.connect(this.ctx.destination);
        this.fxGain = this.ctx.createGain();
        this.fxGain.gain.value = this.effectsVolume;
        this.fxGain.connect(this.master);
        this.ambGain = this.ctx.createGain();
        this.ambGain.gain.value = this.ambienceVolume;
        this.ambGain.connect(this.master);
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  setVolume(v: number) { this.volume = Math.max(0, Math.min(1, v)); if (this.master) this.master.gain.value = this.muted ? 0 : this.volume; }
  setEffectsVolume(v: number) { this.effectsVolume = Math.max(0, Math.min(1, v)); if (this.fxGain) this.fxGain.gain.value = this.effectsVolume; }
  setAmbienceVolume(v: number) { this.ambienceVolume = Math.max(0, Math.min(1, v)); if (this.ambGain) this.ambGain.gain.value = this.ambienceVolume; }
  setMuted(m: boolean) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }

  private noiseBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (this.bufferCache) return this.bufferCache;
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.bufferCache = buf;
    return buf;
  }

  private tone(opts: { type: OscillatorType; f0: number; f1?: number; dur: number; gain?: number; delay?: number }) {
    if (!this.ctx || !this.fxGain || this.muted) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1 && opts.f1 !== opts.f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.22, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g).connect(this.fxGain);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.02);
  }

  private noise(opts: { dur: number; gain?: number; type?: BiquadFilterType; freq?: number; freqTo?: number; delay?: number }) {
    if (!this.ctx || !this.fxGain || this.muted) return;
    const buf = this.noiseBuffer();
    if (!buf) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.type ?? 'lowpass';
    filter.frequency.setValueAtTime(opts.freq ?? 800, t0);
    if (opts.freqTo) filter.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqTo), t0 + opts.dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.gain ?? 0.15, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filter).connect(g).connect(this.fxGain);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  play(name: SoundName) {
    this.resume();
    switch (name) {
      case 'key': this.tone({ type: 'square', f0: 880, dur: 0.045, gain: 0.12 }); break;
      case 'keyHover': this.tone({ type: 'square', f0: 1320, dur: 0.02, gain: 0.04 }); break;
      case 'confirm': this.tone({ type: 'square', f0: 660, dur: 0.06, gain: 0.14 }); this.tone({ type: 'square', f0: 990, dur: 0.07, gain: 0.12, delay: 0.06 }); break;
      case 'back': this.tone({ type: 'square', f0: 520, f1: 300, dur: 0.09, gain: 0.12 }); break;
      case 'warp': this.tone({ type: 'sawtooth', f0: 200, f1: 1400, dur: 0.35, gain: 0.12 }); break;
      case 'fire': this.noise({ dur: 0.5, gain: 0.3, type: 'lowpass', freq: 500, freqTo: 90 }); this.tone({ type: 'sawtooth', f0: 90, f1: 40, dur: 0.45, gain: 0.2 }); break;
      case 'com': this.tone({ type: 'sine', f0: 740, dur: 0.12, gain: 0.14 }); this.tone({ type: 'sine', f0: 1100, dur: 0.12, gain: 0.12, delay: 0.13 }); break;
      case 'scan': this.tone({ type: 'sine', f0: 1500, f1: 2200, dur: 0.25, gain: 0.12 }); this.tone({ type: 'sine', f0: 2200, f1: 1500, dur: 0.2, gain: 0.08, delay: 0.25 }); break;
      case 'shldOn': this.tone({ type: 'triangle', f0: 300, f1: 1200, dur: 0.3, gain: 0.16 }); break;
      case 'shldOff': this.tone({ type: 'triangle', f0: 1200, f1: 300, dur: 0.3, gain: 0.16 }); break;
      case 'error': this.tone({ type: 'square', f0: 160, dur: 0.22, gain: 0.2 }); this.tone({ type: 'square', f0: 150, dur: 0.22, gain: 0.18, delay: 0.24 }); break;
      case 'attach': this.noise({ dur: 0.22, gain: 0.1, type: 'bandpass', freq: 900, freqTo: 1800 }); this.tone({ type: 'square', f0: 520, f1: 880, dur: 0.1, gain: 0.1 }); break;
      case 'beep': this.tone({ type: 'square', f0: 1040, dur: 0.08, gain: 0.14 }); break;
      case 'alarm': this.tone({ type: 'square', f0: 900, dur: 0.3, gain: 0.18 }); this.tone({ type: 'square', f0: 700, dur: 0.3, gain: 0.18, delay: 0.3 }); break;
      case 'tick': this.tone({ type: 'square', f0: 1200, dur: 0.03, gain: 0.08 }); break;
      case 'rumble': this.noise({ dur: 2.4, gain: 0.35, type: 'lowpass', freq: 220, freqTo: 420 }); break;
      case 'storm': this.noise({ dur: 1.6, gain: 0.22, type: 'bandpass', freq: 300, freqTo: 2600 }); break;
      case 'static': this.noise({ dur: 0.9, gain: 0.18, type: 'highpass', freq: 1200 }); break;
      case 'success': [660, 880, 990, 1320].forEach((f, i) => this.tone({ type: 'square', f0: f, dur: 0.16, gain: 0.14, delay: i * 0.15 })); break;
      case 'failure': this.tone({ type: 'sawtooth', f0: 400, f1: 60, dur: 1.1, gain: 0.2 }); break;
      case 'lockOpen': this.tone({ type: 'square', f0: 440, dur: 0.08, gain: 0.12 }); this.tone({ type: 'square', f0: 660, dur: 0.1, gain: 0.12, delay: 0.09 }); this.tone({ type: 'square', f0: 1320, dur: 0.3, gain: 0.14, delay: 0.2 }); break;
      default: break;
    }
  }

  /** Low ambient drone for design screens. */
  startDrone() {
    this.resume();
    if (!this.ctx || !this.ambGain || this.droneNodes) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 6;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 2);
    osc.connect(g).connect(this.ambGain);
    osc.start(); lfo.start();
    this.droneNodes = { osc, gain: g };
  }

  stopDrone() {
    if (!this.ctx || !this.droneNodes) return;
    const { osc, gain } = this.droneNodes;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
    setTimeout(() => { try { osc.stop(); } catch { /* already stopped */ } }, 900);
    this.droneNodes = null;
  }

  /** Continuous engine rumble that ramps with thrust (0..1) during launch. */
  startRumble() {
    this.resume();
    if (!this.ctx || !this.fxGain || this.rumbleNodes) return;
    const buf = this.noiseBuffer();
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 150;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(filter).connect(g).connect(this.fxGain);
    src.start();
    this.rumbleNodes = { src, gain: g, filter };
  }

  setRumble(level: number) {
    if (!this.ctx || !this.rumbleNodes) return;
    this.rumbleNodes.gain.gain.value = Math.max(0, Math.min(1, level)) * 0.5;
    this.rumbleNodes.filter.frequency.value = 120 + level * 400;
  }

  stopRumble() {
    if (!this.ctx || !this.rumbleNodes) return;
    const { src, gain } = this.rumbleNodes;
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
    setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } }, 700);
    this.rumbleNodes = null;
  }
}

export const sound = new SoundManager();
