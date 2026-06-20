import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'grow-coffee',
  brand: {
    displayName: '커피 키우기',
    primaryColor: '#6F4E37',
    icon: '',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite dev',
      build: 'tsc -b && vite build',
    },
  },
  permissions: [],
  outdir: 'dist',
});
