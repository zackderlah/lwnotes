/**
 * Light haptic feedback via the Vibration API (Android / some desktop).
 * iOS Safari often does not expose navigator.vibrate — calls are safe no-ops.
 */

function pulse(ms) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms)
    }
  } catch {
    /* ignore */
  }
}

function pattern(seq) {
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(seq)
    }
  } catch {
    /* ignore */
  }
}

/** Bottom nav or primary tab change */
export function hapticTab() {
  pulse(11)
}

/** Opening the full-screen note editor */
export function hapticOpenSheet() {
  pulse(16)
}

/** Closing the note editor (back) */
export function hapticCloseSheet() {
  pattern([10, 22, 12])
}

/** Secondary actions: prefs rows, dialogs, folder chips */
export function hapticLight() {
  pulse(9)
}
