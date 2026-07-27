// Fisher–Yates shuffle (returns a new array, does not mutate input).
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'mix'];

// Filter a list of items (each with a `.difficulty`) by the selected level.
// 'mix' returns everything, shuffled across all difficulties.
export function filterByDifficulty(items, level) {
  if (level === 'mix') return shuffle(items);
  return shuffle(items.filter((it) => it.difficulty === level));
}

// Count how many items exist at each difficulty level.
export function difficultyCounts(items) {
  const c = { easy: 0, medium: 0, hard: 0 };
  for (const it of items) if (c[it.difficulty] !== undefined) c[it.difficulty]++;
  c.mix = items.length;
  return c;
}
