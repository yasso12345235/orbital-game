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
      // High-tech crisp tactile click (dual softened sine + noise click)
      case 'key':
        this.tone({ type: 'triangle', f0: 980, dur: 0.035, gain: 0.08 });
        this.tone({ type: 'sine', f0: 440, dur: 0.025, gain: 0.06 });
        break;
      // Gentle subtle hover blip
      case 'keyHover':
        this.tone({ type: 'sine', f0: 1760, dur: 0.018, gain: 0.03 });
        break;
      // Harmonious celestial confirmation chime
      case 'confirm':
        this.tone({ type: 'sine', f0: 587.33, dur: 0.12, gain: 0.12 }); // D5
        this.tone({ type: 'sine', f0: 880, dur: 0.16, gain: 0.10, delay: 0.05 }); // A5
        this.tone({ type: 'triangle', f0: 1174.66, dur: 0.22, gain: 0.08, delay: 0.1 }); // D6
        break;
      // Warm descending tone
      case 'back':
        this.tone({ type: 'triangle', f0: 620, f1: 310, dur: 0.12, gain: 0.1 });
        break;
      // Cosmic warp whoosh
      case 'warp':
        this.tone({ type: 'sine', f0: 160, f1: 1800, dur: 0.45, gain: 0.14 });
        this.noise({ dur: 0.4, gain: 0.12, type: 'bandpass', freq: 400, freqTo: 2200 });
        break;
      // Rocket thruster roar with deep sub punch
      case 'fire':
        this.noise({ dur: 0.65, gain: 0.35, type: 'lowpass', freq: 750, freqTo: 110 });
        this.tone({ type: 'triangle', f0: 85, f1: 45, dur: 0.5, gain: 0.25 });
        this.tone({ type: 'sine', f0: 130, f1: 60, dur: 0.4, gain: 0.2 });
        break;
      // Communication beacon ping
      case 'com':
        this.tone({ type: 'sine', f0: 880, dur: 0.12, gain: 0.12 });
        this.tone({ type: 'sine', f0: 1320, dur: 0.18, gain: 0.1, delay: 0.1 });
        break;
      // Holographic sensor scan sweep
      case 'scan':
        this.tone({ type: 'sine', f0: 1200, f1: 2400, dur: 0.28, gain: 0.12 });
        this.tone({ type: 'triangle', f0: 2400, f1: 1400, dur: 0.22, gain: 0.09, delay: 0.18 });
        break;
      // Shield activate / deactivate
      case 'shldOn':
        this.tone({ type: 'sine', f0: 280, f1: 1400, dur: 0.35, gain: 0.15 });
        this.noise({ dur: 0.3, gain: 0.08, type: 'bandpass', freq: 1200 });
        break;
      case 'shldOff':
        this.tone({ type: 'sine', f0: 1400, f1: 280, dur: 0.35, gain: 0.15 });
        break;
      // Soft tech error warning
      case 'error':
        this.tone({ type: 'triangle', f0: 220, dur: 0.16, gain: 0.16 });
        this.tone({ type: 'sine', f0: 185, dur: 0.18, gain: 0.18, delay: 0.1 });
        break;
      // Mechanical docking / latch sound
      case 'attach':
        this.noise({ dur: 0.18, gain: 0.15, type: 'bandpass', freq: 1100, freqTo: 2200 });
        this.tone({ type: 'triangle', f0: 440, f1: 880, dur: 0.08, gain: 0.12 });
        break;
      case 'beep':
        this.tone({ type: 'sine', f0: 1174.66, dur: 0.07, gain: 0.12 });
        break;
      case 'alarm':
        this.tone({ type: 'sawtooth', f0: 880, dur: 0.2, gain: 0.15 });
        this.tone({ type: 'sine', f0: 740, dur: 0.2, gain: 0.15, delay: 0.22 });
        break;
      case 'tick':
        this.tone({ type: 'sine', f0: 1400, dur: 0.02, gain: 0.06 });
        break;
      // Deep visceral rocket launch rumble
      case 'rumble':
        this.noise({ dur: 3.0, gain: 0.42, type: 'lowpass', freq: 260, freqTo: 480 });
        this.tone({ type: 'triangle', f0: 55, f1: 42, dur: 2.2, gain: 0.3 });
        break;
      case 'storm':
        this.noise({ dur: 1.8, gain: 0.24, type: 'bandpass', freq: 350, freqTo: 2800 });
        break;
      case 'static':
        this.noise({ dur: 0.7, gain: 0.12, type: 'highpass', freq: 1400 });
        break;
      // Uplifting mission success fanfare
      case 'success':
        [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((f, i) =>
          this.tone({ type: 'sine', f0: f, dur: 0.28, gain: 0.13, delay: i * 0.11 })
        );
        break;
      case 'failure':
        this.tone({ type: 'sawtooth', f0: 320, f1: 50, dur: 1.2, gain: 0.22 });
        this.noise({ dur: 0.8, gain: 0.15, type: 'lowpass', freq: 300 });
        break;
      case 'lockOpen':
        this.tone({ type: 'sine', f0: 440, dur: 0.09, gain: 0.1 });
        this.tone({ type: 'sine', f0: 659.25, dur: 0.1, gain: 0.12, delay: 0.08 });
        this.tone({ type: 'sine', f0: 1318.51, dur: 0.35, gain: 0.15, delay: 0.18 });
        break;
      default: break;
    }
  }

  /** Ambient cosmic synthesizer drone for game screens. */
  startDrone() {
    this.resume();
    if (!this.ctx || !this.ambGain || this.droneNodes) return;
    const osc = this.ctx.createOscillator();
    const sub = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 55;
    sub.type = 'triangle';
    sub.frequency.value = 110;
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 4;
    lfo.connect(lfoGain).connect(osc.frequency);
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.045, this.ctx.currentTime + 2.5);
    osc.connect(g).connect(this.ambGain);
    sub.connect(g).connect(this.ambGain);
    osc.start(); sub.start(); lfo.start();
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
    filter.type = 'lowpass'; filter.frequency.value = 180;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(filter).connect(g).connect(this.fxGain);
    src.start();
    this.rumbleNodes = { src, gain: g, filter };
  }

  setRumble(level: number) {
    if (!this.ctx || !this.rumbleNodes) return;
    this.rumbleNodes.gain.gain.value = Math.max(0, Math.min(1, level)) * 0.45;
    this.rumbleNodes.filter.frequency.value = 140 + level * 520;
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
