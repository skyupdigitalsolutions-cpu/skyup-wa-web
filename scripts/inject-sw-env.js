#!/usr/bin/env node
// scripts/inject-sw-env.js
// ─────────────────────────────────────────────────────────────────────────────
// Runs AFTER `vite build` to replace the __VITE_FIREBASE_*__ placeholder
// strings in the compiled firebase-messaging-sw.js with real values from
// the .env file (or CI environment variables).
//
// Why: service workers are static files — they can't use import.meta.env,
// so Vite's env injection doesn't touch them. This script fills the gap.
//
// Usage: called automatically via the "build" script in package.json.
// Can also be run manually: node scripts/inject-sw-env.js
// ─────────────────────────────────────────────────────────────────────────────

import {readFileSync, writeFileSync, existsSync} from 'fs';
import {resolve, dirname} from 'path';
import {fileURLToPath} from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Load .env if present (CI usually has real env vars already set)
const envPath = resolve(root, '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = val;
  }
}

const swPath = resolve(root, 'dist', 'firebase-messaging-sw.js');
if (!existsSync(swPath)) {
  console.error('[inject-sw-env] dist/firebase-messaging-sw.js not found — run vite build first.');
  process.exit(1);
}

const replacements = {
  __VITE_FIREBASE_API_KEY__:            process.env.VITE_FIREBASE_API_KEY            || '',
  __VITE_FIREBASE_AUTH_DOMAIN__:        process.env.VITE_FIREBASE_AUTH_DOMAIN        || '',
  __VITE_FIREBASE_PROJECT_ID__:         process.env.VITE_FIREBASE_PROJECT_ID         || '',
  __VITE_FIREBASE_STORAGE_BUCKET__:     process.env.VITE_FIREBASE_STORAGE_BUCKET     || '',
  __VITE_FIREBASE_MESSAGING_SENDER_ID__:process.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| '',
  __VITE_FIREBASE_APP_ID__:             process.env.VITE_FIREBASE_APP_ID             || '',
};

const missing = Object.entries(replacements).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.warn(
    '[inject-sw-env] WARNING: the following env vars are empty — push notifications ' +
    'will not work until they are set:\n  ' + missing.join('\n  '),
  );
}

let src = readFileSync(swPath, 'utf8');
for (const [placeholder, value] of Object.entries(replacements)) {
  // Replace every occurrence (there's one per key, but be safe).
  src = src.replaceAll(placeholder, value.replace(/'/g, "\\'"));
}
writeFileSync(swPath, src, 'utf8');
console.log('[inject-sw-env] Firebase config injected into dist/firebase-messaging-sw.js');
