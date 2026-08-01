// Study-reminder notifications. Two layers:
//   1. A foreground scheduler that fires at the user's chosen time while a tab/PWA is open
//      (reliable, works everywhere notifications are allowed).
//   2. Best-effort background delivery via Periodic Background Sync — only some browsers
//      (installed Android PWAs on Chromium) support it, and THEY decide the exact timing.
// Settings live in localStorage; the SW notification handlers live in public/sw-custom.js.

const SETTINGS_KEY = 'qb-reminder';
const LAST_FIRED_KEY = 'qb-reminder-last';
const REMINDER_TAG = 'study-reminder';
const ICON = '/pwa/icon-192.png';
const DEFAULTS = { enabled: false, time: '19:00' };

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function notificationPermission() {
  return 'Notification' in window ? Notification.permission : 'denied';
}

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function getReminderSettings() {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveReminderSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...DEFAULTS, ...settings }));
  } catch {
    /* storage unavailable — reminders just won't persist */
  }
}

async function readyRegistration() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // navigator.serviceWorker.ready NEVER resolves when no SW is registered (e.g. `npm run
    // dev`, where the SW is disabled), which would hang the caller forever. Race it with a
    // short timeout and fall back to null so callers can use `new Notification()` instead.
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
  } catch {
    return null;
  }
}

// Show the reminder notification now (used for the "Send a test" button and the
// foreground scheduler). Prefers the SW registration so clicks are handled by sw-custom.js.
export async function showReminderNow(body) {
  if (notificationPermission() !== 'granted') return false;
  const reg = await readyRegistration();
  const options = {
    body: body || 'Keep your streak alive — take a quick quiz.',
    icon: ICON,
    badge: ICON,
    tag: REMINDER_TAG,
    renotify: true,
    data: { url: '/quizzes' },
  };
  try {
    if (reg) await reg.showNotification('Time to study! 📚', options);
    else new Notification('Time to study! 📚', options);
    return true;
  } catch {
    return false;
  }
}

// Best-effort background daily reminder. Returns true if it was registered.
export async function enableBackgroundReminder() {
  const reg = await readyRegistration();
  if (!reg || !('periodicSync' in reg)) return false;
  try {
    const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
    if (status.state !== 'granted') return false;
    await reg.periodicSync.register(REMINDER_TAG, { minInterval: 24 * 60 * 60 * 1000 });
    return true;
  } catch {
    return false;
  }
}

export async function disableBackgroundReminder() {
  const reg = await readyRegistration();
  if (!reg || !('periodicSync' in reg)) return;
  try {
    await reg.periodicSync.unregister(REMINDER_TAG);
  } catch {
    /* ignore */
  }
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function checkAndFire() {
  const { enabled, time } = getReminderSettings();
  if (!enabled || notificationPermission() !== 'granted') return;
  const [h, m] = String(time).split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return;
  const now = new Date();
  const due = now.getHours() > h || (now.getHours() === h && now.getMinutes() >= m);
  if (!due) return;
  let last = null;
  try {
    last = localStorage.getItem(LAST_FIRED_KEY);
  } catch {
    /* ignore */
  }
  if (last === todayKey()) return; // already reminded today
  try {
    localStorage.setItem(LAST_FIRED_KEY, todayKey());
  } catch {
    /* ignore */
  }
  await showReminderNow();
}

let intervalId = null;
// Start the foreground scheduler (checks every minute while a tab is open). Idempotent.
export function startForegroundReminder() {
  if (typeof window === 'undefined' || intervalId) return;
  intervalId = window.setInterval(checkAndFire, 60 * 1000);
  checkAndFire(); // also check immediately on start
}

export function stopForegroundReminder() {
  if (intervalId) {
    window.clearInterval(intervalId);
    intervalId = null;
  }
}
