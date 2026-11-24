import { WeaponId } from './types';

export class RetroAudio {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private musicTimer: number | null = null;
  private stepIndex = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (mute) {
      this.stopGroove();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const len = this.ctx.sampleRate * 1.2;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public startGroove(): void {
    if (this.muted || this.musicTimer !== null) return;
    const bassNotes = [55, 55, 65.4, 55, 73.4, 55, 61.7, 58.3];
    this.musicTimer = window.setInterval(() => {
      if (this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const freq = bassNotes[this.stepIndex % bassNotes.length];
      this.stepIndex++;

      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 0.18);

      gain.gain.setValueAtTime(0.055, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    }, 210);
  }

  public stopGroove(): void {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public playWeaponFire(weapon: WeaponId): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    if (weapon === 'chainsaw') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(92 + Math.random() * 18, now);
      osc.frequency.linearRampToValueAtTime(74, now + 0.09);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.11);
    } else if (weapon === 'pistol') {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1400, now);
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.25, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.12);

      const osc = ctx.createOscillator();
      const oGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);
      oGain.gain.setValueAtTime(0.2, now);
      oGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(oGain);
      oGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (weapon === 'shotgun' || weapon === 'supershotgun') {
      const isSuper = weapon === 'supershotgun';
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isSuper ? 2200 : 1800, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + (isSuper ? 0.38 : 0.28));

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(isSuper ? 0.62 : 0.45, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + (isSuper ? 0.4 : 0.3));
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + (isSuper ? 0.42 : 0.32));

      const sub = ctx.createOscillator();
      const sGain = ctx.createGain();
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(isSuper ? 185 : 150, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + (isSuper ? 0.26 : 0.18));
      sGain.gain.setValueAtTime(isSuper ? 0.52 : 0.4, now);
      sGain.gain.exponentialRampToValueAtTime(0.001, now + (isSuper ? 0.28 : 0.2));
      sub.connect(sGain);
      sGain.connect(ctx.destination);
      sub.start(now);
      sub.stop(now + (isSuper ? 0.29 : 0.21));

      const click = ctx.createOscillator();
      const cGain = ctx.createGain();
      click.type = 'square';
      const clickAt = isSuper ? 0.36 : 0.28;
      click.frequency.setValueAtTime(420, now + clickAt);
      click.frequency.setValueAtTime(590, now + clickAt + 0.06);
      cGain.gain.setValueAtTime(0.0001, now);
      cGain.gain.setValueAtTime(0.08, now + clickAt);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + clickAt + 0.14);
      click.connect(cGain);
      cGain.connect(ctx.destination);
      click.start(now + clickAt - 0.01);
      click.stop(now + clickAt + 0.15);
    } else if (weapon === 'chaingun') {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.08);

      const punch = ctx.createOscillator();
      const pGain = ctx.createGain();
      punch.type = 'square';
      punch.frequency.setValueAtTime(185, now);
      punch.frequency.exponentialRampToValueAtTime(65, now + 0.06);
      pGain.gain.setValueAtTime(0.14, now);
      pGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      punch.connect(pGain);
      pGain.connect(ctx.destination);
      punch.start(now);
      punch.stop(now + 0.075);
    } else if (weapon === 'plasma') {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc2.type = 'square';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(190, now + 0.11);
      osc2.frequency.setValueAtTime(1380, now);
      osc2.frequency.exponentialRampToValueAtTime(240, now + 0.1);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc2.start(now);
      osc.stop(now + 0.12);
      osc2.stop(now + 0.12);
    } else if (weapon === 'bfg') {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      sub.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.14);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.55);
      sub.frequency.setValueAtTime(160, now);
      sub.frequency.exponentialRampToValueAtTime(34, now + 0.55);
      gain.gain.setValueAtTime(0.42, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
      osc.connect(gain);
      sub.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      sub.start(now);
      osc.stop(now + 0.6);
      sub.stop(now + 0.6);
    } else {
      // Rocket launch
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(480, now);
      filter.frequency.exponentialRampToValueAtTime(160, now + 0.35);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(now);
      noise.stop(now + 0.4);
    }
  }

  public playExplosion(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.exponentialRampToValueAtTime(70, now + 0.65);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.58, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.7);

    const sub = ctx.createOscillator();
    const sGain = ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.5);
    sGain.gain.setValueAtTime(0.5, now);
    sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    sub.connect(sGain);
    sGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.56);
  }

  public playEnemyHit(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.09);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  public playEnemyAlert(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(260, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.25);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playEnemyDeath(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.32);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  }

  public playPlayerHurt(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(135, now);
    osc.frequency.exponentialRampToValueAtTime(52, now + 0.2);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.23);
  }

  public playPickup(isKey = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = isKey ? [523, 659, 784, 1046] : [440, 660];
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.055);
      gain.gain.setValueAtTime(0.14, now + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.14);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.15);
    });
  }

  public playDoor(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(85, now);
    osc.frequency.linearRampToValueAtTime(130, now + 0.28);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.33);
  }

  public dispose(): void {
    this.stopGroove();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
