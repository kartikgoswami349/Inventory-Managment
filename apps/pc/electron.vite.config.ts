import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    define: {
      __R58_AUTO_UPDATE__: JSON.stringify(process.env.R58_AUTO_UPDATE !== 'false'),
    },
  },
  preload: {},
  renderer: {
    plugins: [react()],
  },
});
