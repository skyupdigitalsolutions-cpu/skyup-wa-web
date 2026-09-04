// src/services/badgeService.js
// ─────────────────────────────────────────────────────────────────────────────
// Wraps the standard Badging API (navigator.setAppBadge / clearAppBadge).
// Only has any visible effect when the site is installed as a PWA — in a
// regular browser tab there's no app icon to badge, so these calls are safe
// no-ops there (feature-detected, never throws).
// ─────────────────────────────────────────────────────────────────────────────

export function isBadgingSupported() {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

export async function updateBadge(count) {
  if (!isBadgingSupported()) return;
  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
  } catch (e) {
    // Some browsers advertise the API but reject certain call patterns —
    // never let a badge failure affect the rest of the app.
    console.warn('[Badge] update failed:', e.message);
  }
}

export async function clearBadge() {
  if (!isBadgingSupported()) return;
  try {
    await navigator.clearAppBadge();
  } catch (e) {
    console.warn('[Badge] clear failed:', e.message);
  }
}
