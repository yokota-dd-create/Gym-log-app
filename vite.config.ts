import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gym Log Tracker',
        short_name: 'GymLog',
        description: '筋トレ記録とレストタイマーを管理するワークアウトアプリ',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone', // URLバーを隠してアプリのように全画面表示
        orientation: 'portrait',
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'https://cdn-icons-png.flaticon.com/512/2964/2964514.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});