// Achievement badges derived from a user's aggregate stats and study streak.
// Pure and dependency-free: given the same inputs it always returns the same list,
// so it can be called straight from render.

// Clamp a raw percentage into a rounded 0–100 integer.
const clampPct = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

// Build the full badge list. `earned` is always a real boolean; every badge also
// carries a `progress` (0–100) so locked tiles can render a completion bar.
export function computeBadges({ stats, streak, topicCount } = {}) {
  const summary = stats?.summary || {};
  const byTopic = stats?.byTopic || [];
  const s = streak || {};

  const attempts = summary.attempts || 0;
  const answered = summary.answered || 0;
  const bestPct = summary.bestPct || 0;
  const bestStreak = s.best || 0;
  const triedTopics = byTopic.length;
  const topics = topicCount || 0;

  return [
    {
      id: 'first-quiz',
      icon: '🎯',
      name: 'First Steps',
      description: 'Complete your first quiz',
      earned: attempts >= 1,
      progress: clampPct(attempts * 100),
    },
    {
      id: 'q100',
      icon: '💯',
      name: 'Century',
      description: 'Answer 100 questions',
      earned: answered >= 100,
      progress: clampPct((answered / 100) * 100),
    },
    {
      id: 'q500',
      icon: '📚',
      name: 'Scholar',
      description: 'Answer 500 questions',
      earned: answered >= 500,
      progress: clampPct((answered / 500) * 100),
    },
    {
      id: 'q1000',
      icon: '🧠',
      name: 'Master',
      description: 'Answer 1,000 questions',
      earned: answered >= 1000,
      progress: clampPct((answered / 1000) * 100),
    },
    {
      id: 'perfect',
      icon: '🏆',
      name: 'Perfectionist',
      description: 'Score 100% on a quiz',
      earned: bestPct >= 100,
      progress: clampPct(bestPct),
    },
    {
      id: 'sharp',
      icon: '🎖️',
      name: 'Sharpshooter',
      description: 'Score 90% or higher on a quiz',
      earned: bestPct >= 90,
      progress: clampPct((bestPct / 90) * 100),
    },
    {
      id: 'explorer',
      icon: '🗺️',
      name: 'Explorer',
      description: 'Try every topic',
      earned: topics > 0 && triedTopics >= topics,
      progress: topics > 0 ? clampPct((triedTopics / topics) * 100) : 0,
    },
    {
      id: 'streak3',
      icon: '🔥',
      name: 'Getting Warm',
      description: 'Reach a 3-day streak',
      earned: bestStreak >= 3,
      progress: clampPct((bestStreak / 3) * 100),
    },
    {
      id: 'streak7',
      icon: '⚡',
      name: 'On Fire',
      description: 'Reach a 7-day streak',
      earned: bestStreak >= 7,
      progress: clampPct((bestStreak / 7) * 100),
    },
    {
      id: 'dedicated',
      icon: '🌟',
      name: 'Dedicated',
      description: 'Complete 25 quizzes',
      earned: attempts >= 25,
      progress: clampPct((attempts / 25) * 100),
    },
  ];
}
