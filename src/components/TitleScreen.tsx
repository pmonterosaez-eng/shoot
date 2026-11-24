import { useEffect } from 'react';
import { Film, Gamepad2, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { LEVELS } from '../game/levels';
import { DIFFICULTY_SPECS, Difficulty } from '../game/types';
import { ExtensionInstallButton } from './ExtensionInstallButton';
import { PWAInstallButton } from './PWAInstallButton';

interface TitleScreenProps {
  difficulty: Difficulty;
  startSectorIndex: number;
  muted: boolean;
  gamepadConnected: boolean;
  optionsOpen: boolean;
  cinematicOpen: boolean;
  onStart: (d: Difficulty) => void;
  onOpenIntro: () => void;
  onOpenOptions: () => void;
  onToggleMute: () => void;
}

export function TitleScreen({
  difficulty,
  startSectorIndex,
  muted,
  gamepadConnected,
  optionsOpen,
  cinematicOpen,
  onStart,
  onOpenIntro,
  onOpenOptions,
  onToggleMute,
}: TitleScreenProps) {
  useEffect(() => {
    if (optionsOpen || cinematicOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (document.querySelector('[data-install-modal]')) return;
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart(difficulty);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [difficulty, optionsOpen, cinematicOpen, onStart]);

  const activeLevel = LEVELS[startSectorIndex] ?? LEVELS[0];

  return (
    <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10 pointer-events-none bg-gradient-to-b from-black/70 via-transparent to-black/85">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="px-3 py-1.5 bg-[#121014]/90 border border-stone-700/80 text-[11px] tracking-[0.2em] text-amber-400 uppercase font-bold">
            10 SECTORES · CUARTOS SECRETOS · 8 ARMAS
          </div>
          {gamepadConnected && (
            <div className="px-2.5 py-1.5 bg-[#121014]/90 border border-emerald-500/80 text-[11px] tracking-[0.16em] text-emerald-300 uppercase font-bold flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>MANDO PS3 / PC LISTO</span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExtensionInstallButton compact />
          <PWAInstallButton compact />
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Activar sonido' : 'Silenciar sonido'}
            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 bg-[#121014]/90 hover:bg-[#1e1a21] border border-stone-700 text-xs tracking-wider text-stone-200 uppercase cursor-pointer transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
            <span>{muted ? 'SILENCIO' : 'AUDIO ON'}</span>
          </button>
        </div>
      </div>

      {/* Center Hero Lockup */}
      <div className="my-auto flex flex-col items-center text-center max-w-2xl mx-auto">
        <svg
          viewBox="0 0 640 165"
          className="w-full max-w-[540px] drop-shadow-[0_8px_18px_rgba(0,0,0,0.95)]"
          role="img"
          aria-label="AVERNO-93"
        >
          <defs>
            <linearGradient id="doomTitleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffdc66" />
              <stop offset="45%" stopColor="#ff6b1a" />
              <stop offset="100%" stopColor="#9e1212" />
            </linearGradient>
            <linearGradient id="steelRim" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5c6473" />
              <stop offset="50%" stopColor="#a7b0c2" />
              <stop offset="100%" stopColor="#434954" />
            </linearGradient>
          </defs>
          <polygon points="320,6 348,26 320,38 292,26" fill="#ff3b1f" stroke="#ffd24d" strokeWidth="2" />
          <path d="M90 36 L260 36 L275 44 L90 44 Z" fill="url(#steelRim)" opacity="0.8" />
          <path d="M550 36 L380 36 L365 44 L550 44 Z" fill="url(#steelRim)" opacity="0.8" />

          <text
            x="320"
            y="122"
            textAnchor="middle"
            fill="url(#doomTitleGrad)"
            stroke="#1b0707"
            strokeWidth="7"
            paintOrder="stroke"
            fontFamily="Impact, 'Arial Black', sans-serif"
            fontWeight="900"
            fontSize="94"
            letterSpacing="6"
          >
            AVERNO-93
          </text>
          <text
            x="320"
            y="153"
            textAnchor="middle"
            fill="#d6d3d1"
            fontFamily="ui-monospace, monospace"
            fontWeight="700"
            fontSize="14"
            letterSpacing="8"
          >
            PROTOCOLO DE CONTENCIÓN ABISAL
          </text>
        </svg>

        {/* Primary CTA & Options */}
        <div className="mt-7 flex flex-col items-center gap-2.5 pointer-events-auto">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="px-3.5 py-1 bg-[#121014]/95 border border-stone-700 text-[11px] font-bold tracking-[0.18em] uppercase text-stone-300">
              DIFICULTAD:{' '}
              <span
                className={
                  difficulty === 'facil'
                    ? 'text-emerald-400'
                    : difficulty === 'normal'
                    ? 'text-amber-400'
                    : 'text-red-400'
                }
              >
                {DIFFICULTY_SPECS[difficulty].label}
              </span>
            </div>
            <div className="px-3.5 py-1 bg-[#121014]/95 border border-stone-700 text-[11px] font-bold tracking-[0.18em] uppercase text-amber-300">
              {activeLevel.code} · {activeLevel.name}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onStart(difficulty)}
            className="w-64 py-3.5 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 active:translate-y-0.5 text-white font-black text-base tracking-[0.2em] uppercase border-2 border-amber-400/90 retro-bevel cursor-pointer transition-colors"
          >
            INICIAR ASALTO
          </button>

          <button
            type="button"
            onClick={onOpenIntro}
            className="w-64 py-2 bg-[#1a1518]/95 hover:bg-[#271d22] border border-amber-600/70 text-amber-300 font-bold text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>VER VIDEO INTRO</span>
          </button>

          <button
            type="button"
            onClick={onOpenOptions}
            className="w-64 py-2.5 bg-[#141318]/95 hover:bg-[#201e27] border border-stone-600 text-stone-200 font-bold text-xs tracking-[0.2em] uppercase flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <span>OPCIONES Y SECTORES</span>
          </button>
        </div>
      </div>

      {/* Single Flat Control-Hint Line */}
      <div className="text-center">
        <p className="inline-block px-4 py-1.5 bg-[#0e0c10]/90 border border-stone-800 text-[11px] md:text-xs tracking-[0.14em] text-stone-300 uppercase">
          {gamepadConnected
            ? 'Sticks Mover/Apuntar · R2/✕ Disparar · L2 Correr · L1/R1 Armas · □/○ Abrir/Secretos · Start Pausa'
            : 'WASD Mover · Ratón/Flechas Apuntar · Click/Espacio Disparar · 1-8 Armas · E Abrir/Secretos · Mando PS3/PC'}
        </p>
      </div>
    </div>
  );
}
