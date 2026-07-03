import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [vue(), tailwindcss()],
  server: {
    watch: {
      ignored: ['**/.tmp-chrome*/**', '**/tmp-header*.png'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('lightweight-charts')) {
            return 'charts';
          }

          if (id.includes('xlsx')) {
            return 'spreadsheet';
          }

          if (id.includes('vue-router') || id.includes(`${'/node_modules/'}vue${'/'}`)) {
            return 'vue-core';
          }

          return 'vendor';
        },
      },
    },
  },
});
