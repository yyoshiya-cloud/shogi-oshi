import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png'],
        manifest: ({
          id: '/',
          name: '将棋推し活アプリ',
          short_name: '将棋推し活アプリ',
          description: 'プロ棋士・女流棋士（連盟・LPSA・無所属）の推し活アプリ。対局予定カレンダー、プッシュ通知、勝敗速報、棋譜リンク、通算成績・過去対戦履歴の統計グラフを完備。',
          theme_color: '#1a1816',
          background_color: '#121110',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            {
              name: '推し棋士直近対局',
              short_name: '直近対局',
              description: '推し棋士の直近の対局・結果をすばやく確認',
              url: '/?tab=dashboard',
              icons: [{ src: '/icon-192.png', sizes: '192x192' }],
            },
          ],
          widgets: [
            {
              name: '推し棋士 直近対局ウィジェット',
              short_name: '対局ウィジェット',
              description: '推し棋士の最新の対局・勝敗結果をホーム画面で確認',
              tag: 'oshi-match-widget',
              template: 'oshi-widget-template',
              ms_ac_template: 'widgets/oshi-match.json',
              screenshots: [
                {
                  src: '/icon-512.png',
                  sizes: '512x512',
                  label: '推し棋士直近対局ウィジェット',
                },
              ],
              icons: [
                {
                  src: '/icon-192.png',
                  sizes: '192x192',
                },
              ],
            },
          ],
        } as any),
        workbox: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
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
