import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension';
  const outDirName = isExtension ? 'dist-extension' : 'dist';

  return {
    base: isExtension ? './' : '/',
    plugins: [
      react(),
      tailwindcss(),
      ...(isExtension
        ? [
            {
              name: 'stub-pwa-register-for-extension',
              resolveId(id: string) {
                if (id === 'virtual:pwa-register') return '\0virtual:pwa-register-stub';
              },
              load(id: string) {
                if (id === '\0virtual:pwa-register-stub') {
                  return 'export function registerSW() { return () => {}; }';
                }
              },
            },
          ]
        : [
            VitePWA({
              registerType: 'autoUpdate',
              includeAssets: [
                'icon.svg',
                'apple-touch-icon.png',
                'pwa-192x192.png',
                'pwa-512x512.png',
                'pwa-maskable-512x512.png',
              ],
              manifest: {
                id: '/',
                name: 'AVERNO-93',
                short_name: 'AVERNO-93',
                description:
                  'Juego FPS 3D estilo retro Doom con 10 sectores distintos, 8 armas, hordas de demonios y soporte completo para gamepad.',
                theme_color: '#09080a',
                background_color: '#09080a',
                display: 'standalone',
                start_url: '/',
                scope: '/',
                icons: [
                  {
                    src: '/pwa-192x192.png',
                    sizes: '192x192',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: '/pwa-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'any',
                  },
                  {
                    src: '/pwa-maskable-512x512.png',
                    sizes: '512x512',
                    type: 'image/png',
                    purpose: 'maskable',
                  },
                ],
              },
              workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
              },
              devOptions: {
                enabled: true,
                type: 'module',
              },
            }),
          ]),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, outDirName);
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
          if (isExtension) {
            const extSrc = path.resolve(__dirname, 'extension-src');
            if (fs.existsSync(extSrc) && fs.existsSync(distDir)) {
              fs.cpSync(extSrc, distDir, { recursive: true, force: true });
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2018',
      outDir: outDirName,
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
