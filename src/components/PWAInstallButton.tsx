import { useState } from 'react';
import { Download, Monitor, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  const isExtension =
    typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:';

  if (isInstalled || isExtension) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          compact
            ? 'pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#121014]/90 hover:bg-[#1e1a21] border border-amber-500/70 text-xs font-bold tracking-wider text-amber-300 uppercase cursor-pointer transition-colors'
            : 'w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#141318] hover:bg-[#201e27] border border-amber-500/80 text-xs font-bold tracking-[0.16em] text-amber-300 uppercase cursor-pointer transition-colors'
        }
      >
        <Download className="w-3.5 h-3.5" />
        <span>INSTALAR EN PC</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 pointer-events-auto">
          <div className="w-full max-w-md bg-[#131217] border-2 border-amber-500/80 retro-bevel p-6 text-left">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black tracking-[0.16em] text-amber-400 uppercase">
                  {isIOS ? 'INSTALAR EN IPHONE / IPAD' : 'INSTALAR AVERNO-93 EN PC'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar guía de instalación"
                className="p-1 bg-[#1b1922] hover:bg-[#292633] border border-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2 text-xs text-stone-300 leading-relaxed list-decimal list-inside">
                <li>Pulsa el botón Compartir en la barra de Safari.</li>
                <li>Desplázate hacia abajo y selecciona Añadir a pantalla de inicio.</li>
              </ol>
            ) : (
              <div className="space-y-2.5 text-xs text-stone-300 leading-relaxed">
                <p>
                  Puedes instalar AVERNO-93 como aplicación nativa de escritorio (con acceso directo y ventana independiente sin navegador):
                </p>
                <ol className="space-y-1.5 list-decimal list-inside text-stone-200">
                  <li>Si estás viendo el juego dentro de una vista previa embebida, ábrelo primero en su propia pestaña.</li>
                  <li>Haz clic en el icono de Instalar en la barra de direcciones de Chrome o Edge (o Menú → Guardar y compartir → Instalar AVERNO-93).</li>
                  <li>Se creará un acceso directo ejecutable en tu escritorio y menú Inicio, compatible incluso sin conexión.</li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-black text-xs font-black tracking-[0.18em] uppercase cursor-pointer"
            >
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </>
  );
}
