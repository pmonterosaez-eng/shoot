import { useEffect } from 'react';
import { Gamepad2, Skull, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import { LEVELS } from '../game/levels';
import { DIFFICULTY_SPECS, Difficulty } from '../game/types';
import { PWAInstallButton } from './PWAInstallButton';

interface OptionsModalProps {
  difficulty: Difficulty;
  startSectorIndex: number;
  sensitivity: number;
  invertY: boolean;
  muted: boolean;
  gamepadConnected: boolean;
  gamepadName: string | null;
  gamepadBlocked: boolean;
  inGame: boolean;
  onSelectDifficulty: (d: Difficulty) => void;
  onSelectStartSector: (index: number) => void;
  onChangeSensitivity: (val: number) => void;
  onToggleInvertY: () => void;
  onToggleMute: () => void;
  onClose: () => void;
}

const DIFFICULTIES: Difficulty[] = ['facil', 'normal', 'pesadilla'];

export function OptionsModal({
  difficulty,
  startSectorIndex,
  sensitivity,
  invertY,
  muted,
  gamepadConnected,
  gamepadName,
  gamepadBlocked,
  inGame,
  onSelectDifficulty,
  onSelectStartSector,
  onChangeSensitivity,
  onToggleInvertY,
  onToggleMute,
  onClose,
}: OptionsModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#131217] border-2 border-stone-600 retro-bevel p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-400" />
            <h2 className="text-lg font-black tracking-[0.18em] text-amber-400 uppercase">
              MENÚ DE OPCIONES
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar opciones"
            className="p-1.5 bg-[#1b1922] hover:bg-[#292633] border border-stone-700 text-stone-300 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Difficulty Selector */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold tracking-[0.18em] text-stone-400 uppercase">
              DIFICULTAD DE COMBATE
            </span>
            {inGame && (
              <span className="text-[10px] tracking-wider text-amber-400/90 uppercase">
                APLICA AL REINICIAR / REFUERZOS
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map((d) => {
              const spec = DIFFICULTY_SPECS[d];
              const active = difficulty === d;
              const activeBorder =
                d === 'facil'
                  ? 'border-emerald-400 bg-emerald-950/60'
                  : d === 'normal'
                  ? 'border-amber-400 bg-amber-950/55'
                  : 'border-red-500 bg-red-950/65';
              const badgeColor =
                d === 'facil'
                  ? 'text-emerald-300'
                  : d === 'normal'
                  ? 'text-amber-300'
                  : 'text-red-400';

              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onSelectDifficulty(d)}
                  className={`w-full text-left px-3.5 py-2 border cursor-pointer transition-colors ${
                    active
                      ? activeBorder
                      : 'border-stone-700 bg-[#0d0c10] hover:border-stone-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-black tracking-[0.18em] ${active ? badgeColor : 'text-stone-200'}`}>
                      {spec.label}
                    </span>
                    <span className="text-[10px] font-bold tracking-widest text-stone-400">
                      {spec.tag}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-400 mt-0.5">{spec.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sector Selector (10 Distinct Levels) */}
        {!inGame && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold tracking-[0.18em] text-stone-400 uppercase">
                SECTOR INICIAL (10 NIVELES DISTINTOS)
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {LEVELS.map((lvl, idx) => {
                const active = startSectorIndex === idx;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => onSelectStartSector(idx)}
                    title={`${lvl.code}: ${lvl.name}`}
                    className={`px-1.5 py-2 border text-center cursor-pointer transition-colors ${
                      active
                        ? lvl.isBossLevel
                          ? 'bg-red-950/85 border-red-400 text-red-200'
                          : 'bg-amber-950/70 border-amber-400 text-amber-300'
                        : 'bg-[#0d0c10] border-stone-700 text-stone-300 hover:border-stone-500'
                    }`}
                  >
                    <div className="text-[10px] font-black tracking-wider flex items-center justify-center gap-0.5">
                      {lvl.isBossLevel && <Skull className="w-3 h-3 text-red-400 shrink-0" />}
                      <span>{lvl.code}</span>
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-amber-300/90 mt-1.5 truncate">
              {LEVELS[startSectorIndex]?.code} · {LEVELS[startSectorIndex]?.name} —{' '}
              {LEVELS[startSectorIndex]?.subtitle}
            </p>
          </div>
        )}

        {/* Aim Sensitivity */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold tracking-[0.18em] text-stone-400 uppercase">
              SENSIBILIDAD DE APUNTADO
            </span>
            <span className="text-xs font-black text-amber-300 tabular-nums">
              {sensitivity.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={sensitivity}
            onChange={(e) => onChangeSensitivity(parseFloat(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-stone-500 tracking-wider mt-0.5">
            <span>LENTO (0.5x)</span>
            <span>ESTÁNDAR (1.0x)</span>
            <span>RÁPIDO (2.0x)</span>
          </div>
        </div>

        {/* Invert Y & Audio */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={onToggleInvertY}
            className={`px-3 py-2 border text-[11px] font-bold tracking-wider uppercase cursor-pointer ${
              invertY
                ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                : 'bg-[#0d0c10] border-stone-700 text-stone-300 hover:border-stone-500'
            }`}
          >
            EJE Y MANDO: {invertY ? 'INVERTIDO' : 'NORMAL'}
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-[#0d0c10] hover:bg-[#1b1922] border border-stone-700 text-[11px] font-bold tracking-wider uppercase cursor-pointer"
          >
            {muted ? (
              <>
                <VolumeX className="w-3.5 h-3.5 text-red-400" />
                <span className="text-red-300">SILENCIO</span>
              </>
            ) : (
              <>
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300">AUDIO ON</span>
              </>
            )}
          </button>
        </div>

        {/* Gamepad Status Diagnostics */}
        <div className="mb-4 p-3 bg-[#0d0c10] border border-stone-800">
          <div className="flex items-center gap-2 mb-1">
            <Gamepad2 className={`w-4 h-4 ${gamepadConnected ? 'text-emerald-400' : gamepadBlocked ? 'text-red-400' : 'text-stone-400'}`} />
            <span className="text-[11px] font-bold tracking-[0.16em] uppercase text-stone-200">
              {gamepadBlocked
                ? 'MANDO BLOQUEADO POR EL VISOR'
                : gamepadConnected
                ? 'MANDO CONECTADO'
                : 'ESPERANDO MANDO'}
            </span>
          </div>
          {gamepadBlocked ? (
            <p className="text-[11px] text-red-300/90 leading-snug">
              El iframe contenedor restringe la API de Gamepad por política de permisos. Abre la app en su propia pestaña del navegador para usar el mando.
            </p>
          ) : gamepadConnected ? (
            <p className="text-[11px] text-emerald-300/90 truncate">{gamepadName}</p>
          ) : (
            <p className="text-[11px] text-stone-400 leading-snug">
              Conecta tu mando de PlayStation 3 (DualShock 3 / SIXAXIS por USB o Bluetooth), Xbox o PC y pulsa ✕/A/Start con esta ventana activa.
            </p>
          )}
        </div>

        {/* PC App Install Button */}
        <div className="mb-4">
          <PWAInstallButton />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-black tracking-[0.2em] uppercase cursor-pointer"
        >
          GUARDAR Y VOLVER [ESC]
        </button>
      </div>
    </div>
  );
}
