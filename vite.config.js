import {defineConfig, loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import {readFileSync, writeFileSync} from 'fs';
import {resolve} from 'path';

// ── injectSwEnv plugin ────────────────────────────────────────────────────────
// Cloudflare Workers (wrangler deploy) serves public/ as static assets and
// does NOT process them through the normal dist/ pipeline, so the separate
// scripts/inject-sw-env.js post-build step never runs. Instead we inject
// the Firebase config into firebase-messaging-sw.js HERE, during vite build,
// by writing the real values directly into the dist/ copy of the file.
// Service workers cannot use import.meta.env, so this is the only safe way.
function injectSwEnv(env) {
  return {
    name: 'inject-sw-env',
    closeBundle() {
      const swPath = resolve(__dirname, 'dist', 'firebase-messaging-sw.js');
      let src;
      try {
        src = readFileSync(swPath, 'utf8');
      } catch {
        console.warn('[inject-sw-env] dist/firebase-messaging-sw.js not found — skipping.');
        return;
      }

      const replacements = {
        '__VITE_FIREBASE_API_KEY__':             env.VITE_FIREBASE_API_KEY             || '',
        '__VITE_FIREBASE_AUTH_DOMAIN__':         env.VITE_FIREBASE_AUTH_DOMAIN         || '',
        '__VITE_FIREBASE_PROJECT_ID__':          env.VITE_FIREBASE_PROJECT_ID          || '',
        '__VITE_FIREBASE_STORAGE_BUCKET__':      env.VITE_FIREBASE_STORAGE_BUCKET      || '',
        '__VITE_FIREBASE_MESSAGING_SENDER_ID__': env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
        '__VITE_FIREBASE_APP_ID__':              env.VITE_FIREBASE_APP_ID              || '',
      };

      const missing = Object.entries(replacements)
        .filter(([, v]) => !v)
        .map(([k]) => k);
      if (missing.length) {
        console.warn(
          '[inject-sw-env] WARNING: missing env vars — push will not work:\n  ' +
          missing.join('\n  '),
        );
      }

      for (const [placeholder, value] of Object.entries(replacements)) {
        src = src.replaceAll(placeholder, value.replace(/'/g, "\\'"));
      }

      writeFileSync(swPath, src, 'utf8');
      console.log('[inject-sw-env] Firebase config injected into dist/firebase-messaging-sw.js ✓');
    },
  };
}

// __dirname is not available in ESM — reconstruct it.
import {fileURLToPath} from 'url';
import {dirname} from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({mode}) => {
  // Load env so the plugin can read VITE_FIREBASE_* values.
  // loadEnv also picks up real CI/platform environment variables (Cloudflare
  // Pages injects them into process.env before the build runs).
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), injectSwEnv(env)],
    server: {
      port: 5173,
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
    },
  };
});
