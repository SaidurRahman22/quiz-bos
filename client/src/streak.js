// Daily study streak, tracked per-account in localStorage (works offline & for guests).
// A streak counts consecutive local-calendar days with at least one completed quiz.

const keyFor = (uid) => `qb-streak-${uid || 'guest'}`;

function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Whole-day difference between two 'YYYY-MM-DD' local dates (b - a).
function dayGap(a, b) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db - da) / 86400000);
}

function read(uid) {
  try {
    return JSON.parse(localStorage.getItem(keyFor(uid))) || null;
  } catch {
    return null;
  }
}

function write(uid, state) {
  try {
    localStorage.setItem(keyFor(uid), JSON.stringify(state));
  } catch {
    /* storage unavailable — streak just won't persist */
  }
}

// Current streak for display: alive only if the last active day was today or yesterday,
// otherwise it has lapsed and reads as 0 (a fresh completion restarts it at 1).
export function getStreak(uid) {
  const s = read(uid) || { current: 0, best: 0, lastActive: null };
  let current = s.current || 0;
  if (!s.lastActive || dayGap(s.lastActive, localDate()) > 1) current = 0;
  return { current, best: s.best || 0, lastActive: s.lastActive || null, activeToday: s.lastActive === localDate() };
}

// Call when the user completes a quiz. Advances the streak once per day.
export function recordStudyActivity(uid) {
  const s = read(uid) || { current: 0, best: 0, lastActive: null };
  const today = localDate();
  if (s.lastActive === today) {
    // already counted today — no change
  } else if (s.lastActive && dayGap(s.lastActive, today) === 1) {
    s.current = (s.current || 0) + 1; // consecutive day
  } else {
    s.current = 1; // first ever, or streak had lapsed
  }
  s.lastActive = today;
  s.best = Math.max(s.best || 0, s.current);
  write(uid, s);
  return getStreak(uid);
}
