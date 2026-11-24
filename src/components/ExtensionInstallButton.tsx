import { useState } from 'react';
import { Download, Puzzle, X } from 'lucide-react';

interface ExtensionInstallButtonProps {
  compact?: boolean;
}

export function ExtensionInstallButton({ compact = false }: ExtensionInstallButtonProps) {
  const [showModal, setShowModal] = useState(false);

  const isExtension =
    typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:';

  if (isExtension) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className={
          compact
            ? 'pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#121014]/90 hover:bg-[#1e1a21] border border-emerald-500/70 text-xs font-bold tracking-wider text-emerald-300 uppercase cursor-pointer transition-colors'
            : 'w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#141318] hover:bg-[#201e27] border border-emerald-500/80 text-xs font-bold tracking-[0.16em] text-emerald-300 uppercase cursor-pointer transition-colors'
        }
      >
        <Puzzle className="w-3.5 h-3.5" />
        <span>EXTENSIÓN CHROME / BRAVE</span>
      </button>

      {showModal && (
        <div
          data-install-modal="extension"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 pointer-events-auto"
        >
          <div className="w-full max-w-md bg-[#131217] border-2 border-emerald-500/80 retro-bevel p-6 text-left">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Puzzle className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black tracking-[0.16em] text-emerald-400 uppercase">
                  EXTENSIÓN CHROME Y BRAVE (MV3)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Cerrar guía de extensión"
                className="p-1 bg-[#1b1922] hover:bg-[#292633] border border-stone-700 text-stone-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-stone-300 leading-relaxed">
              <p>
                Instala AVERNO-93 como extensión oficial Manifest V3 en <strong>Google Chrome</strong> o{' '}
                <strong>Brave</strong> para jugarlo directo desde tu barra de herramientas incluso sin internet.
              </p>

              <a
                href="/averno93-chrome-brave-extension.zip"
                download="averno93-chrome-brave-extension.zip"
                className="w-full py-3 px-4 bg-gradient-to-b from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700 border-2 border-emerald-300/80 text-white font-black tracking-[0.16em] uppercase flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>DESCARGAR EXTENSIÓN (.ZIP)</span>
              </a>

              <ol className="space-y-1.5 list-decimal list-inside text-stone-200 pt-1">
                <li>Descomprime el archivo ZIP descargado en una carpeta de tu PC.</li>
                <li>
                  Abre <code className="px-1 py-0.5 bg-[#1b1922] text-amber-300">chrome://extensions</code> (Chrome) o{' '}
                  <code className="px-1 py-0.5 bg-[#1b1922] text-amber-300">brave://extensions</code> (Brave).
                </li>
                <li>Activa el interruptor <strong>Modo de desarrollador</strong> arriba a la derecha.</li>
                <li>
                  Pulsa <strong>Cargar descomprimida</strong> y selecciona la carpeta extraída.
                </li>
              </ol>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 bg-[#1d1b24] hover:bg-[#292633] border border-stone-600 text-stone-200 text-xs font-black tracking-[0.18em] uppercase cursor-pointer"
            >
              CERRAR
            </button>
          </div>
        </div>
      )}
    </>
  );
}
