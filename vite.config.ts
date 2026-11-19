import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', '**/*.sqlite*', '**/server/**', '**/src-tauri/**'],
    },
    watch: { ignored: ['**/src-tauri/**', '**/data/**'] },
  },
});
