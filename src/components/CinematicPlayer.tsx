import { useEffect, useRef, useState } from 'react';
import { FastForward, Play, Volume2, VolumeX } from 'lucide-react';

interface CinematicPlayerProps {
  mode: 'intro' | 'ending';
  muted: boolean;
  onToggleMute: () => void;
  onComplete: () => void;
}

interface SceneBeat {
  start: number;
  end: number;
  tag: string;
  subtitle: string;
}

const INTRO_BEATS: SceneBeat[] = [
  {
    start: 0,
    end: 4.5,
    tag: 'TRANSMISIÓN DE EMERGENCIA · MARTE 2193',
    subtitle: 'La estación orbital AVERNO-93 ha perdido toda señal tras perforar el subsuelo marciano.',
  },
  {
    start: 4.5,
    end: 9.0,
    tag: 'BRECHA DIMENSIONAL ACTIVA',
    subtitle: 'Un portal infernal rasgó el reactor central. Hordas de demonios ahora dominan los 10 sectores.',
  },
  {
    start: 9.0,
    end: 13.5,
    tag: 'AMENAZA OMEGA: EL TITÁN DEL AVERNO',
    subtitle: 'En el último sector aguarda el Titán del Averno. Busca cuartos secretos y desata tus 8 armas.',
  },
  {
    start: 13.5,
    end: 18.0,
    tag: 'VISOR TÁCTICO EN LÍNEA',
    subtitle: 'Blindaje listo. Munición infinita cargada. Entra al hangar y sobrevive al infierno.',
  },
];

const ENDING_BEATS: SceneBeat[] = [
  {
    start: 0,
    end: 4.5,
    tag: 'NÚCLEO DEL TITÁN DESTRUIDO',
    subtitle: 'El coloso infernal cae hecho cenizas mientras su reactor de magma colapsa por completo.',
  },
  {
    start: 4.5,
    end: 9.0,
    tag: 'SELLADO DEL PORTAL ABISAL',
    subtitle: 'La grieta dimensional implosiona en el cielo de Marte y la legión demoníaca queda erradicada.',
  },
  {
    start: 9.0,
    end: 13.5,
    tag: 'EXTRACCIÓN COMPLETADA',
    subtitle: 'Despegas sobre las ruinas ardientes del complejo mientras el amanecer ilumina el planeta rojo.',
  },
  {
    start: 13.5,
    end: 18.0,
    tag: 'FIN DE LA CAMPAÑA · AVERNO CONQUISTADO',
    subtitle: 'Has purgado los 10 sectores y derrotado al Titán del Averno. ¡Victoria total, Marín!',
  },
];

const TOTAL_DURATION = 18.0;

export function CinematicPlayer({ mode, muted, onToggleMute, onComplete }: CinematicPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const completedRef = useRef(false);
  const beats = mode === 'intro' ? INTRO_BEATS : ENDING_BEATS;

  // Procedural Web Audio cinematic score synchronized with scene timeline
  useEffect(() => {
    if (muted) return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioCtx();
    } catch {
      return;
    }

    const master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);

    // Sub-bass cinematic drone
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = mode === 'intro' ? 'sawtooth' : 'triangle';
    drone.frequency.setValueAtTime(mode === 'intro' ? 46.25 : 65.41, ctx.currentTime);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mode === 'intro' ? 210 : 360;
    droneGain.gain.setValueAtTime(0.001, ctx.currentTime);
    droneGain.gain.linearRampToValueAtTime(0.42, ctx.currentTime + 1.2);
    droneGain.gain.setValueAtTime(0.42, ctx.currentTime + TOTAL_DURATION - 1.5);
    droneGain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + TOTAL_DURATION);
    drone.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(master);
    drone.start();

    // Pulsing cinematic chords per act
    const notes =
      mode === 'intro'
        ? [110, 103.83, 98, 130.81, 146.83, 110, 82.41, 164.81]
        : [130.81, 164.81, 196, 261.63, 220, 261.63, 329.63, 392];
    const stepTimer = window.setInterval(() => {
      if (!ctx || ctx.state === 'closed') return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const note = notes[Math.floor((ctx.currentTime * 0.9) % notes.length)];
      osc.type = mode === 'intro' ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(note, ctx.currentTime);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = mode === 'intro' ? 580 : 1100;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.65);
      osc.connect(lp);
      lp.connect(g);
      g.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + 1.7);
    }, 1150);

    return () => {
      clearInterval(stepTimer);
      try {
        drone.stop();
        ctx?.close();
      } catch {
        // ignore close errors
      }
    };
  }, [mode, muted]);

  // Keyboard & Gamepad skip listeners (PS3 X/Start, Enter, Space, Escape)
  useEffect(() => {
    const finish = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    };
    window.addEventListener('keydown', onKey, true);

    let prevBtn = false;
    const padPoll = window.setInterval(() => {
      try {
        const pads = navigator.getGamepads?.() || [];
        for (let i = 0; i < pads.length; i++) {
          const p = pads[i];
          if (!p || !p.connected) continue;
          const pressed = Boolean(p.buttons[0]?.pressed || p.buttons[1]?.pressed || p.buttons[9]?.pressed);
          if (pressed && !prevBtn) {
            finish();
          }
          prevBtn = pressed;
          break;
        }
      } catch {
        // ignore restricted gamepad context
      }
    }, 80);

    return () => {
      window.removeEventListener('keydown', onKey, true);
      clearInterval(padPoll);
    };
  }, [onComplete]);

  // 60fps Canvas Cinematic Renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const startMs = performance.now();
    let rafId = 0;

    // Pre-generate deterministic stars & particles
    const stars = Array.from({ length: 120 }, (_, i) => ({
      x: ((i * 73.13) % 1),
      y: ((i * 41.79) % 1),
      size: 0.8 + (i % 3) * 0.75,
      speed: 0.015 + (i % 5) * 0.008,
    }));

    const renderFrame = (now: number) => {
      const t = (now - startMs) / 1000;
      setElapsed(Math.min(TOTAL_DURATION, t));

      if (t >= TOTAL_DURATION && !completedRef.current) {
        completedRef.current = true;
        onComplete();
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const act = Math.min(3, Math.floor(t / 4.5));
      const localT = (t % 4.5) / 4.5;

      // Sky / background gradient per act
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      if (mode === 'intro') {
        if (act === 0) {
          bg.addColorStop(0, '#04050b');
          bg.addColorStop(0.65, '#190b10');
          bg.addColorStop(1, '#52150e');
        } else if (act === 1) {
          bg.addColorStop(0, '#0a0308');
          bg.addColorStop(0.5, '#33080b');
          bg.addColorStop(1, '#85180c');
        } else if (act === 2) {
          bg.addColorStop(0, '#080205');
          bg.addColorStop(0.6, '#2b0907');
          bg.addColorStop(1, '#a6260b');
        } else {
          bg.addColorStop(0, '#060c12');
          bg.addColorStop(0.5, '#0e1d26');
          bg.addColorStop(1, '#1c120d');
        }
      } else {
        if (act === 0) {
          bg.addColorStop(0, '#140507');
          bg.addColorStop(0.5, '#4a120a');
          bg.addColorStop(1, '#d9480f');
        } else if (act === 1) {
          bg.addColorStop(0, '#060e18');
          bg.addColorStop(0.55, '#132d3d');
          bg.addColorStop(1, '#2a1814');
        } else if (act === 2) {
          bg.addColorStop(0, '#07111e');
          bg.addColorStop(0.5, '#2b3d59');
          bg.addColorStop(1, '#c2592b');
        } else {
          bg.addColorStop(0, '#0c1829');
          bg.addColorStop(0.55, '#593b25');
          bg.addColorStop(1, '#e89635');
        }
      }
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Moving starfield
      for (const s of stars) {
        const sx = ((s.x + t * s.speed) % 1) * w;
        const sy = s.y * h * 0.72;
        const twinkle = 0.45 + 0.55 * Math.sin(t * 3 + s.x * 20);
        ctx.fillStyle = `rgba(255,245,230,${twinkle.toFixed(2)})`;
        ctx.fillRect(sx, sy, s.size, s.size);
      }

      // Scene-specific 3D perspective visuals
      if (mode === 'intro') {
        if (act === 0) {
          // Mars planet + Orbital Station AVERNO-93
          const planetR = w * 0.24;
          const pGrad = ctx.createRadialGradient(w * 0.56, h * 0.72, planetR * 0.15, w * 0.56, h * 0.85, planetR);
          pGrad.addColorStop(0, '#e05324');
          pGrad.addColorStop(0.55, '#8c2212');
          pGrad.addColorStop(1, '#1a0605');
          ctx.fillStyle = pGrad;
          ctx.beginPath();
          ctx.arc(w * 0.56, h * 0.86, planetR, 0, Math.PI * 2);
          ctx.fill();

          // Orbital station sliding smoothly
          const stX = w * (0.28 + localT * 0.24);
          const stY = h * (0.34 - localT * 0.04);
          ctx.save();
          ctx.translate(stX, stY);
          ctx.fillStyle = '#5c6678';
          ctx.fillRect(-75, -10, 150, 20);
          ctx.fillStyle = '#333a47';
          ctx.fillRect(-35, -28, 70, 56);
          ctx.fillStyle = '#9aa6ba';
          ctx.fillRect(-95, -4, 190, 8);
          // Flashing red emergency beacon
          const beaconAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 6));
          const bGlow = ctx.createRadialGradient(0, -32, 1, 0, -32, 26);
          bGlow.addColorStop(0, `rgba(255,60,40,${beaconAlpha})`);
          bGlow.addColorStop(1, 'rgba(255,0,0,0)');
          ctx.fillStyle = bGlow;
          ctx.beginPath();
          ctx.arc(0, -32, 26, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (act === 1) {
          // Hell portal rift + emerging demon silhouettes
          const pulse = 1 + Math.sin(t * 8) * 0.08;
          const cx = w * 0.5;
          const cy = h * 0.48;
          const portalGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 190 * pulse);
          portalGrad.addColorStop(0, '#fff2b2');
          portalGrad.addColorStop(0.25, '#ff5511');
          portalGrad.addColorStop(0.65, '#990b16');
          portalGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = portalGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 190 * pulse, 0, Math.PI * 2);
          ctx.fill();

          // Portal ring
          ctx.strokeStyle = '#ff8822';
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.ellipse(cx, cy, 84 * pulse, 130 * pulse, 0, 0, Math.PI * 2);
          ctx.stroke();

          // Jagged mountains & demon shadows
          ctx.fillStyle = '#120608';
          ctx.beginPath();
          ctx.moveTo(0, h);
          ctx.lineTo(0, h * 0.68);
          ctx.lineTo(w * 0.25, h * 0.56);
          ctx.lineTo(w * 0.5, h * 0.72);
          ctx.lineTo(w * 0.75, h * 0.54);
          ctx.lineTo(w, h * 0.68);
          ctx.lineTo(w, h);
          ctx.fill();

          // Glowing demon eyes in the mist
          for (let i = -2; i <= 2; i++) {
            if (i === 0) continue;
            const ex = cx + i * 85;
            const ey = h * 0.68 + Math.abs(i) * 8;
            ctx.fillStyle = '#ffdd33';
            ctx.beginPath();
            ctx.arc(ex - 7, ey, 3.5, 0, Math.PI * 2);
            ctx.arc(ex + 7, ey, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (act === 2) {
          // Towering Titan Boss Silhouette rising
          const zoom = 0.88 + localT * 0.22;
          ctx.save();
          ctx.translate(w * 0.5, h * 0.85);
          ctx.scale(zoom, zoom);

          // Backlight aura
          const aura = ctx.createRadialGradient(0, -170, 20, 0, -170, 260);
          aura.addColorStop(0, 'rgba(255,95,20,0.85)');
          aura.addColorStop(1, 'rgba(120,10,5,0)');
          ctx.fillStyle = aura;
          ctx.beginPath();
          ctx.arc(0, -170, 260, 0, Math.PI * 2);
          ctx.fill();

          // Titan body silhouette
          ctx.fillStyle = '#16090d';
          ctx.beginPath();
          ctx.moveTo(-110, 40);
          ctx.lineTo(-95, -180);
          ctx.lineTo(-145, -220);
          ctx.lineTo(-75, -235);
          ctx.lineTo(-42, -295);
          ctx.lineTo(-72, -355);
          ctx.lineTo(-22, -312);
          ctx.lineTo(0, -340);
          ctx.lineTo(22, -312);
          ctx.lineTo(72, -355);
          ctx.lineTo(42, -295);
          ctx.lineTo(75, -235);
          ctx.lineTo(145, -220);
          ctx.lineTo(95, -180);
          ctx.lineTo(110, 40);
          ctx.closePath();
          ctx.fill();

          // Magma Reactor Core & Eyes
          const coreGlow = ctx.createRadialGradient(0, -180, 4, 0, -180, 48);
          coreGlow.addColorStop(0, '#fff299');
          coreGlow.addColorStop(0.5, '#ff5500');
          coreGlow.addColorStop(1, 'rgba(255,50,0,0)');
          ctx.fillStyle = coreGlow;
          ctx.beginPath();
          ctx.arc(0, -180, 48, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#ffe055';
          ctx.beginPath();
          ctx.arc(-18, -268, 5.5, 0, Math.PI * 2);
          ctx.arc(18, -268, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          // Tactical Helmet Visor Lock-On
          const cx = w * 0.5;
          const cy = h * 0.48;
          ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
          ctx.lineWidth = 2;
          const r = 135 - localT * 35;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();

          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(cx - 28, cy);
          ctx.lineTo(cx - 8, cy);
          ctx.moveTo(cx + 8, cy);
          ctx.lineTo(cx + 28, cy);
          ctx.moveTo(cx, cy - 28);
          ctx.lineTo(cx, cy - 8);
          ctx.moveTo(cx, cy + 8);
          ctx.lineTo(cx, cy + 28);
          ctx.stroke();

          ctx.fillStyle = '#f59e0b';
          ctx.font = '900 42px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('AVERNO-93', cx, cy - 62);
        }
      } else {
        // ENDING VIDEO SCENES
        if (act === 0) {
          // Titan Reactor Implosion Shockwave
          const cx = w * 0.5;
          const cy = h * 0.48;
          const blastR = 30 + localT * 340;
          const expGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, blastR);
          expGrad.addColorStop(0, '#ffffff');
          expGrad.addColorStop(0.35, '#ffbb33');
          expGrad.addColorStop(0.7, 'rgba(255,60,15,0.7)');
          expGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = expGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, blastR, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = `rgba(255, 220, 120, ${(1 - localT).toFixed(2)})`;
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.arc(cx, cy, blastR * 0.82, 0, Math.PI * 2);
          ctx.stroke();
        } else if (act === 1) {
          // Portal collapsing into tranquil cyan particles
          const cx = w * 0.5;
          const cy = h * 0.46;
          const shrink = Math.max(0.05, 1 - localT);
          const sealGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, 170 * shrink);
          sealGrad.addColorStop(0, '#a5f3fc');
          sealGrad.addColorStop(0.45, '#22d3ee');
          sealGrad.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sealGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, 170 * shrink, 0, Math.PI * 2);
          ctx.fill();
        } else if (act === 2) {
          // Dropship escaping across Martian dawn horizon
          ctx.fillStyle = '#3b1c12';
          ctx.beginPath();
          ctx.moveTo(0, h);
          ctx.lineTo(0, h * 0.72);
          ctx.lineTo(w * 0.35, h * 0.64);
          ctx.lineTo(w * 0.68, h * 0.74);
          ctx.lineTo(w, h * 0.62);
          ctx.lineTo(w, h);
          ctx.fill();

          const shipX = w * (0.18 + localT * 0.65);
          const shipY = h * (0.55 - localT * 0.25);
          ctx.save();
          ctx.translate(shipX, shipY);
          ctx.rotate(-0.18);
          // Thruster flame
          const flame = ctx.createLinearGradient(-75, 0, -25, 0);
          flame.addColorStop(0, 'rgba(56,189,248,0)');
          flame.addColorStop(1, '#67e8f9');
          ctx.fillStyle = flame;
          ctx.fillRect(-85, -4, 58, 8);
          // Dropship hull
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(-34, 12);
          ctx.lineTo(-18, -14);
          ctx.lineTo(42, -4);
          ctx.lineTo(54, 10);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(14, -7, 18, 6);
          ctx.restore();
        } else {
          // Golden Sunrise Victory Emblem
          const cx = w * 0.5;
          const cy = h * 0.45;
          const sun = ctx.createRadialGradient(cx, cy + 40, 20, cx, cy + 40, 230);
          sun.addColorStop(0, 'rgba(255,235,140,0.95)');
          sun.addColorStop(0.45, 'rgba(245,158,11,0.45)');
          sun.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = sun;
          ctx.beginPath();
          ctx.arc(cx, cy + 40, 230, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#fde047';
          ctx.font = '900 40px ui-monospace, monospace';
          ctx.textAlign = 'center';
          ctx.fillText('MISIÓN CUMPLIDA', cx, cy - 12);
          ctx.fillStyle = '#e7e5e4';
          ctx.font = '700 18px ui-monospace, monospace';
          ctx.fillText('AVERNO-93 · CAMPAÑA COMPLETADA', cx, cy + 28);
        }
      }

      // Floating embers
      for (let i = 0; i < 24; i++) {
        const ex = ((i * 53.7 + t * (18 + (i % 4) * 9)) % w);
        const ey = h - (((i * 39.1 + t * (45 + (i % 5) * 14)) % (h * 0.9)));
        ctx.fillStyle = mode === 'ending' && act >= 2 ? 'rgba(253,224,71,0.75)' : 'rgba(255,115,35,0.75)';
        ctx.beginPath();
        ctx.arc(ex, ey, 2 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [mode, onComplete]);

  const activeBeat = beats.find((b) => elapsed >= b.start && elapsed < b.end) ?? beats[beats.length - 1];
  const progressPct = Math.min(100, (elapsed / TOTAL_DURATION) * 100);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black p-4 md:p-8">
      <div className="w-full max-w-4xl border-2 border-stone-700 bg-[#08070a] retro-bevel overflow-hidden flex flex-col">
        {/* Top Cinema Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#121016] border-b border-stone-800">
          <div className="flex items-center gap-2 text-xs font-black tracking-[0.18em] uppercase text-amber-400">
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{mode === 'intro' ? 'VIDEO DE INTRODUCCIÓN · AVERNO-93' : 'VIDEO FINAL · EPÍLOGO'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="px-2.5 py-1 bg-[#1b1922] hover:bg-[#262330] border border-stone-700 text-[11px] font-bold tracking-wider text-stone-200 flex items-center gap-1.5 cursor-pointer"
            >
              {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-amber-400" />}
              <span>{muted ? 'SILENCIO' : 'SONIDO'}</span>
            </button>
            <button
              type="button"
              onClick={onComplete}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-black text-[11px] font-black tracking-[0.16em] uppercase flex items-center gap-1.5 cursor-pointer"
            >
              <span>SALTAR [ESPACIO]</span>
              <FastForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 16:9 Widescreen Canvas Viewport */}
        <div className="relative w-full aspect-video bg-black">
          <canvas ref={canvasRef} width={960} height={540} className="w-full h-full block" />
          {/* Top & Bottom Cinema Letterbox Subtitles */}
          <div className="absolute inset-x-0 top-0 h-8 bg-black/85 flex items-center px-4">
            <span className="text-[11px] font-bold tracking-[0.2em] text-amber-400/95 uppercase">
              {activeBeat.tag}
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 min-h-14 bg-black/88 border-t border-stone-800/80 flex items-center justify-center px-6 py-2.5 text-center">
            <p className="text-xs sm:text-sm md:text-base font-bold tracking-wide text-stone-100 leading-snug">
              {activeBeat.subtitle}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-stone-900">
          <div
            className="h-full bg-gradient-to-r from-red-600 via-amber-500 to-amber-300 transition-[width] duration-75"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
