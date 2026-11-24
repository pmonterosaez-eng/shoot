import { useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { DIFFICULTY_SPECS, HudSnapshot } from '../game/types';

interface GameModalProps {
  hud: HudSnapshot;
  optionsOpen: boolean;
  onResume: () => void;
  onRestart: () => void;
  onRestartCampaign: () => void;
  onNextSector: () => void;
  onOpenOptions: () => void;
  onTitle: () => void;
}

export function GameModal({
  hud,
  optionsOpen,
  onResume,
  onRestart,
  onRestartCampaign,
  onNextSector,
  onOpenOptions,
  onTitle,
}: GameModalProps) {
  const accuracy = hud.shotsFired > 0 ? Math.round((hud.shotsHit / hud.shotsFired) * 100) : 0;
  const mins = Math.floor(hud.elapsedSeconds / 60);
  const secs = Math.floor(hud.elapsedSeconds % 60);
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  useEffect(() => {
    if (optionsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        if (hud.phase === 'paused') onResume();
        else if (hud.phase === 'sector_clear') onNextSector();
        else if (hud.phase === 'gameover' || hud.phase === 'victory') onRestart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud.phase, optionsOpen, onResume, onNextSector, onRestart]);

  const titles: Record<string, { heading: string; sub: string; accent: string }> = {
    paused: {
      heading: 'SISTEMA EN PAUSA',
      sub: `${hud.sectorCode} · ${hud.sectorName}`,
      accent: 'text-amber-400',
    },
    sector_clear: {
      heading: 'SECTOR DESPEJADO',
      sub: `${hud.sectorCode} COMPLETADO · AVANZANDO AL SIGUIENTE NIVEL`,
      accent: 'text-emerald-400',
    },
    victory: {
      heading: 'AVERNO CONQUISTADO',
      sub: 'HAS ANIQUILADO AL TITÁN DEL AVERNO Y PURGADO LOS 10 SECTORES',
      accent: 'text-amber-300',
    },
    gameover: {
      heading: 'SEÑAL VITAL PERDIDA',
      sub: `CAÍDO EN ${hud.sectorCode} · ${hud.sectorName}`,
      accent: 'text-red-500',
    },
  };

  const info = titles[hud.phase] || titles.paused;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md bg-[#131217] border-2 border-stone-600 retro-bevel p-6 text-center">
        <div className="text-[11px] tracking-[0.22em] text-stone-400 uppercase mb-1">
          TERMINAL TÁCTICA AVERNO-93
        </div>
        <h2 className={`text-2xl font-black tracking-[0.14em] uppercase ${info.accent}`}>
          {info.heading}
        </h2>
        <p className="text-xs tracking-wider text-stone-300 mt-1 mb-5 uppercase">{info.sub}</p>

        {/* Combat Telemetry Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-6 text-left tabular-nums">
          <div className="p-2.5 bg-[#0b0a0e] border border-stone-800">
            <div className="text-[10px] tracking-widest text-stone-500">DEMONIOS</div>
            <div className="text-lg font-black text-red-400">
              {hud.kills} / {hud.totalEnemies}
            </div>
          </div>
          <div className="p-2.5 bg-[#0b0a0e] border border-stone-800">
            <div className="text-[10px] tracking-widest text-stone-500">PRECISIÓN</div>
            <div className="text-lg font-black text-sky-400">{accuracy}%</div>
          </div>
          <div className="p-2.5 bg-[#0b0a0e] border border-stone-800">
            <div className="text-[10px] tracking-widest text-stone-500">TIEMPO</div>
            <div className="text-lg font-black text-stone-200">{timeStr}</div>
          </div>
          <div className="p-2.5 bg-[#0b0a0e] border border-stone-800">
            <div className="text-[10px] tracking-widest text-stone-500">PUNTUACIÓN</div>
            <div className="text-lg font-black text-amber-300">{hud.score}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {hud.phase === 'paused' && (
            <>
              <button
                type="button"
                onClick={onResume}
                className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-black font-black tracking-[0.18em] uppercase cursor-pointer"
              >
                CONTINUAR [ENTER]
              </button>
              <button
                type="button"
                onClick={onOpenOptions}
                className="w-full py-2.5 bg-[#1e1d25] hover:bg-[#2a2833] border border-stone-600 text-stone-200 text-xs font-bold tracking-[0.18em] uppercase flex items-center justify-center gap-2 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span>OPCIONES ({DIFFICULTY_SPECS[hud.difficulty].label})</span>
              </button>
              <button
                type="button"
                onClick={onRestart}
                className="w-full py-2.5 bg-[#1e1d25] hover:bg-[#2a2833] border border-stone-600 text-stone-200 text-xs font-bold tracking-[0.18em] uppercase cursor-pointer"
              >
                REINICIAR SECTOR
              </button>
            </>
          )}
          {hud.phase === 'sector_clear' && (
            <button
              type="button"
              onClick={onNextSector}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-black font-black tracking-[0.18em] uppercase cursor-pointer"
            >
              SIGUIENTE SECTOR [ENTER]
            </button>
          )}
          {(hud.phase === 'gameover' || hud.phase === 'victory') && (
            <>
              <button
                type="button"
                onClick={onRestart}
                className="w-full py-3 bg-red-700 hover:bg-red-600 text-white font-black tracking-[0.18em] uppercase cursor-pointer"
              >
                {hud.phase === 'victory' ? 'REJUGAR COMBATE FINAL' : 'REINTENTAR SECTOR'} [ENTER]
              </button>
              {hud.phase === 'victory' && (
                <button
                  type="button"
                  onClick={onRestartCampaign}
                  className="w-full py-2.5 bg-[#1e1d25] hover:bg-[#2a2833] border border-stone-600 text-amber-300 text-xs font-bold tracking-[0.18em] uppercase cursor-pointer"
                >
                  NUEVA CAMPAÑA (E1M1)
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onTitle}
            className="w-full py-2.5 bg-[#141318] hover:bg-[#1e1d25] border border-stone-700 text-stone-400 hover:text-stone-200 text-xs font-bold tracking-[0.18em] uppercase cursor-pointer"
          >
            MENÚ PRINCIPAL
          </button>
        </div>
      </div>
    </div>
  );
}
