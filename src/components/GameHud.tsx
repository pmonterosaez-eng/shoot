import { useEffect, useRef } from 'react';
import { Gamepad2, Pause, Skull, Volume2, VolumeX } from 'lucide-react';
import { HudSnapshot, WEAPON_ORDER, WEAPON_SPECS, WeaponId } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  onSelectWeapon: (id: WeaponId) => void;
  onToggleMute: () => void;
  onPause: () => void;
}

function MarineVisorSvg({ mood, health }: { mood: HudSnapshot['faceMood']; health: number }) {
  const visorColor =
    mood === 'hurt' || health <= 25
      ? '#ff2a2a'
      : mood === 'firing'
      ? '#ffbb22'
      : mood === 'grin'
      ? '#33ff99'
      : '#22ddff';

  return (
    <svg viewBox="0 0 64 64" className="w-12 h-12 shrink-0 bg-[#14151a] border border-stone-600">
      <polygon points="10,14 54,14 58,28 52,54 12,54 6,28" fill="#3b434f" stroke="#1b1e24" strokeWidth="2" />
      <rect x="20" y="8" width="24" height="8" fill="#525b6b" />
      <polygon
        points="14,24 50,24 46,38 35,34 29,34 18,38"
        fill={visorColor}
        opacity={mood === 'hurt' ? 0.95 : 0.85}
      />
      <rect x="22" y="42" width="20" height="8" fill="#181b20" />
      <line x1="26" y1="42" x2="26" y2="50" stroke="#47505e" strokeWidth="2" />
      <line x1="32" y1="42" x2="32" y2="50" stroke="#47505e" strokeWidth="2" />
      <line x1="38" y1="42" x2="38" y2="50" stroke="#47505e" strokeWidth="2" />
      {mood === 'hurt' && (
        <path d="M16 18 L24 26 M48 18 L40 26" stroke="#ff5555" strokeWidth="2.5" />
      )}
    </svg>
  );
}

export function GameHud({ hud, onSelectWeapon, onToggleMute, onPause }: GameHudProps) {
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rows = hud.automapGrid.length;
    const cols = hud.automapGrid[0]?.length || 1;
    const cellPx = Math.floor(canvas.width / Math.max(rows, cols));
    const offsetX = Math.floor((canvas.width - cols * cellPx) / 2);
    const offsetY = Math.floor((canvas.height - rows * cellPx) / 2);

    ctx.fillStyle = '#09090c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let z = 0; z < rows; z++) {
      for (let x = 0; x < cols; x++) {
        if (!hud.exploredCells[z]?.[x]) continue;
        const ch = hud.automapGrid[z][x];
        const px = offsetX + x * cellPx;
        const py = offsetY + z * cellPx;
        if (ch === '#' || ch === '$' || ch === '=' || ch === '?') {
          ctx.fillStyle = ch === '=' ? '#507288' : ch === '$' ? '#786252' : '#6b7280';
          ctx.fillRect(px, py, cellPx, cellPx);
        } else if (ch === '%' || ch === '&' || ch === '@') {
          ctx.fillStyle = ch === '@' ? '#6e3455' : '#99332b';
          ctx.fillRect(px, py, cellPx, cellPx);
        } else if (ch === '~') {
          ctx.fillStyle = '#3f521a';
          ctx.fillRect(px, py, cellPx, cellPx);
        } else {
          ctx.fillStyle = '#18181f';
          ctx.fillRect(px, py, cellPx, cellPx);
        }
      }
    }

    // Doors, key, exit, enemies, boss
    for (const ent of hud.automapEntities) {
      const gx = Math.round(ent.x);
      const gz = Math.round(ent.z);
      if (!hud.exploredCells[gz]?.[gx] && ent.kind !== 'exit' && ent.kind !== 'boss') continue;
      const cx = offsetX + ent.x * cellPx + cellPx * 0.5;
      const cy = offsetY + ent.z * cellPx + cellPx * 0.5;

      if (ent.kind === 'door') {
        ctx.fillStyle = ent.alive ? '#ff2a2a' : '#22dd88';
        ctx.fillRect(offsetX + ent.x * cellPx, offsetY + ent.z * cellPx, cellPx, cellPx);
      } else if (ent.kind === 'secret') {
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(offsetX + ent.x * cellPx, offsetY + ent.z * cellPx, cellPx, cellPx);
      } else if (ent.kind === 'key') {
        ctx.fillStyle = '#ff3344';
        ctx.fillRect(cx - 2, cy - 2, 5, 5);
      } else if (ent.kind === 'exit') {
        ctx.fillStyle = '#33ff99';
        ctx.fillRect(cx - 2, cy - 2, 5, 5);
      } else if (ent.kind === 'boss') {
        ctx.fillStyle = '#ffdd33';
        ctx.fillRect(cx - 3.5, cy - 3.5, 7, 7);
        ctx.strokeStyle = '#ff2211';
        ctx.strokeRect(cx - 3.5, cy - 3.5, 7, 7);
      } else if (ent.kind === 'enemy') {
        ctx.fillStyle = '#ff8822';
        ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
      }
    }

    // Player arrow
    const plX = offsetX + (hud.playerGridX + 0.5) * cellPx;
    const plY = offsetY + (hud.playerGridZ + 0.5) * cellPx;
    ctx.save();
    ctx.translate(plX, plY);
    ctx.rotate(-hud.playerYaw);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -4.5);
    ctx.lineTo(3.5, 3.5);
    ctx.lineTo(-3.5, 3.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [hud]);

  const gap = 6 + Math.min(18, hud.crosshairSpread);
  const bossPct = hud.boss ? Math.max(0, Math.min(100, (hud.boss.hp / hud.boss.maxHp) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-10 pointer-events-none">
      {/* Damage & Pickup Screen Flashes */}
      {hud.damageFlash > 0.01 && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle, rgba(180,10,10,0.08) 40%, rgba(220,20,20,${(
              hud.damageFlash * 0.52
            ).toFixed(2)}) 100%)`,
          }}
        />
      )}
      {hud.pickupFlash > 0.01 && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: `rgba(255, 215, 90, ${(hud.pickupFlash * 0.16).toFixed(2)})`,
          }}
        />
      )}

      {/* Top-Left Status Cluster */}
      <div className="absolute top-3 left-3 flex flex-col gap-1.5">
        <div className="px-3 py-1.5 bg-[#111015]/92 border border-stone-700 retro-bevel flex items-center gap-3">
          <span className="text-xs font-black tracking-widest text-amber-400">
            {hud.sectorCode}
          </span>
          <span className="text-[11px] font-bold tracking-wider text-stone-200 uppercase">
            {hud.sectorName}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold tracking-wider tabular-nums">
          <div className="px-2.5 py-1 bg-[#111015]/92 border border-stone-700 text-stone-200">
            DEMONIOS <span className="text-red-400">{hud.kills}</span>/{hud.totalEnemies}
          </div>
          {hud.totalSecrets > 0 && (
            <div className="px-2.5 py-1 bg-[#111015]/92 border border-stone-700 text-stone-200">
              SECRETOS <span className="text-amber-300">{hud.secretsFound}</span>/{hud.totalSecrets}
            </div>
          )}
          <div className="px-2.5 py-1 bg-[#111015]/92 border border-stone-700 text-stone-200">
            PTS <span className="text-amber-300">{hud.score}</span>
          </div>
          {!hud.isBossLevel && (
            <div
              className={`px-2.5 py-1 border flex items-center gap-1.5 ${
                hud.hasKey
                  ? 'bg-red-950/95 border-red-500 text-red-200'
                  : 'bg-[#111015]/85 border-stone-800 text-stone-500'
              }`}
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5">
                <rect x="2" y="2" width="12" height="12" rx="1" fill={hud.hasKey ? '#ff2a3c' : '#3a3a42'} />
                <rect x="4" y="4" width="8" height="3" fill={hud.hasKey ? '#ffd24d' : '#52525b'} />
              </svg>
              <span>LLAVE</span>
            </div>
          )}
          {hud.gamepadConnected && (
            <div className="px-2 py-1 bg-[#111015]/92 border border-emerald-600/80 text-emerald-300 flex items-center gap-1">
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>MANDO</span>
            </div>
          )}
        </div>
      </div>

      {/* Top-Center Final Boss Health Bar */}
      {hud.boss && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[min(420px,54vw)] px-3 py-2 bg-[#120b0d]/95 border-2 border-red-600/90 retro-bevel">
          <div className="flex items-center justify-between text-[11px] font-black tracking-[0.16em] uppercase mb-1">
            <span className="flex items-center gap-1.5 text-amber-300">
              <Skull className="w-3.5 h-3.5 text-red-500" />
              {hud.boss.name}
            </span>
            <span className={hud.boss.enraged ? 'text-red-400 tabular-nums' : 'text-stone-300 tabular-nums'}>
              {hud.boss.enraged ? 'ENFURECIDO · ' : ''}
              {hud.boss.hp} / {hud.boss.maxHp}
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#090607] border border-red-950 overflow-hidden">
            <div
              className={
                hud.boss.enraged
                  ? 'h-full bg-gradient-to-r from-red-700 via-red-500 to-amber-400 transition-all duration-75'
                  : 'h-full bg-gradient-to-r from-red-800 via-orange-600 to-amber-400 transition-all duration-75'
              }
              style={{ width: `${bossPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Top-Right Compact Automap & Audio/Pause Controls */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={onToggleMute}
            aria-label={hud.muted ? 'Activar audio' : 'Silenciar audio'}
            className="p-2 bg-[#111015]/92 hover:bg-[#1e1d26] border border-stone-700 text-stone-200 cursor-pointer"
          >
            {hud.muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          </button>
          <button
            type="button"
            onClick={onPause}
            aria-label="Pausar juego"
            className="p-2 bg-[#111015]/92 hover:bg-[#1e1d26] border border-stone-700 text-stone-200 cursor-pointer"
          >
            <Pause className="w-4 h-4 text-stone-200" />
          </button>
        </div>
        <div className="p-1 bg-[#111015]/90 border border-stone-700 retro-bevel">
          <canvas ref={mapCanvasRef} width={102} height={96} className="block" />
        </div>
      </div>

      {/* Dynamic Reticle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative w-12 h-12">
          <div className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 bg-amber-300" />
          <div
            className="absolute left-1/2 w-0.5 h-2 -translate-x-1/2 bg-amber-400/90"
            style={{ top: `${24 - gap - 6}px` }}
          />
          <div
            className="absolute left-1/2 w-0.5 h-2 -translate-x-1/2 bg-amber-400/90"
            style={{ top: `${24 + gap - 2}px` }}
          />
          <div
            className="absolute top-1/2 h-0.5 w-2 -translate-y-1/2 bg-amber-400/90"
            style={{ left: `${24 - gap - 6}px` }}
          />
          <div
            className="absolute top-1/2 h-0.5 w-2 -translate-y-1/2 bg-amber-400/90"
            style={{ left: `${24 + gap - 2}px` }}
          />
        </div>
      </div>

      {/* Center Status / Interaction Prompts */}
      <div className="absolute left-1/2 top-[22%] -translate-x-1/2 flex flex-col items-center gap-2 text-center">
        {hud.statusMessage && (
          <div className="px-3.5 py-1 bg-[#140e0e]/90 border border-amber-500/80 text-xs font-bold tracking-[0.16em] text-amber-300 uppercase">
            {hud.statusMessage}
          </div>
        )}
        {hud.promptText && (
          <div className="px-3.5 py-1.5 bg-[#101318]/95 border border-emerald-400 text-xs font-bold tracking-[0.14em] text-emerald-300 uppercase">
            {hud.promptText}
          </div>
        )}
      </div>

      {/* Pointer Lock / Aiming Hint when unlocked and no gamepad */}
      {!hud.pointerLocked && !hud.gamepadConnected && (
        <div className="absolute left-1/2 bottom-24 -translate-x-1/2 px-3 py-1 bg-[#111015]/85 border border-stone-700 text-[10px] tracking-[0.14em] text-stone-300 uppercase">
          HAZ CLICK EN EL VISOR PARA CAPTURAR RATÓN (O ARRASTRA / FLECHAS)
        </div>
      )}

      {/* Classic Bottom Doom-Style Status Bar with 8 Weapons */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[min(860px,97vw)] bg-[#141318]/95 border-2 border-stone-600 retro-bevel px-3 py-2 flex items-center justify-between gap-2.5">
        {/* Health & Armor */}
        <div className="flex items-center gap-3 tabular-nums shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.18em] text-stone-400 font-bold">SALUD</span>
            <span
              className={`text-xl md:text-2xl font-black leading-none ${
                hud.health <= 25 ? 'text-red-500' : hud.health <= 50 ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              {hud.health}%
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] tracking-[0.18em] text-stone-400 font-bold">BLINDAJE</span>
            <span className="text-xl md:text-2xl font-black leading-none text-sky-400">{hud.armor}%</span>
          </div>
        </div>

        {/* Center Portrait + 8 Weapon Slots */}
        <div className="flex items-center gap-2 min-w-0">
          <MarineVisorSvg mood={hud.faceMood} health={hud.health} />
          <div className="hidden sm:grid grid-cols-4 gap-1 pointer-events-auto">
            {WEAPON_ORDER.map((wId) => {
              const spec = WEAPON_SPECS[wId];
              const unlocked = hud.unlockedWeapons.includes(wId);
              const active = hud.activeWeapon === wId;
              return (
                <button
                  key={wId}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onSelectWeapon(wId)}
                  className={`px-2 py-1 text-[10px] font-bold tracking-wider border cursor-pointer transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-amber-500 text-black border-amber-300'
                      : unlocked
                      ? 'bg-[#1c1b22] text-stone-200 border-stone-600 hover:border-stone-400'
                      : 'bg-[#0f0e12] text-stone-600 border-stone-800 cursor-not-allowed'
                  }`}
                >
                  {spec.slot}·{spec.shortName}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ammo */}
        <div className="flex flex-col items-end tabular-nums shrink-0">
          <span className="text-[10px] tracking-[0.18em] text-stone-400 font-bold">MUNICIÓN</span>
          <span className="text-2xl font-black leading-none text-amber-300">∞</span>
        </div>
      </div>
    </div>
  );
}
