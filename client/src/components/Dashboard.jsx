import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from 'recharts';
import { getStats, getTopics } from '../api.js';
import { getStreak } from '../streak.js';
import { computeBadges } from '../badges.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import CountUp from './CountUp.jsx';
import Loader from './Loader.jsx';

// CVD-safe ordinal ramp (blue, light→dark) for difficulty, validated in dataviz skill.
const DIFF_COLOR = { easy: '#86b6ef', medium: '#3987e5', hard: '#184f95', mix: '#8b5cf6' };

function masteryTier(pct) {
  if (pct >= 85) return 'Mastered';
  if (pct >= 70) return 'Proficient';
  if (pct >= 50) return 'Familiar';
  return 'Needs work';
}

function relativeTime(dateStr) {
  const then = new Date(dateStr).getTime();
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function ChartTooltip({ active, payload, label, suffix = '%' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label != null && <div className="chart-tip-label">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="chart-tip-row">
          <span className="chart-tip-dot" style={{ background: p.color || p.payload?.color }} />
          <span>{p.payload?.name || p.name}</span>
          <strong>
            {Math.round(p.value)}
            {suffix}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [stats, setStats] = useState(null);
  const [topics, setTopics] = useState({});
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getStats(), getTopics()])
      .then(([s, ts]) => {
        setStats(s);
        setTopics(Object.fromEntries(ts.map((t) => [t.slug, t])));
      })
      .catch(() => setError(true));
  }, []);

  const ink = theme === 'dark' ? '#c3c2b7' : '#52514e';
  const grid = theme === 'dark' ? '#2c2c2a' : '#e1e0d9';

  if (error)
    return (
      <div className="alert alert-danger">Could not load your stats. Is the API running?</div>
    );
  if (!stats) return <Loader label="Loading your dashboard…" />;

  const { summary, byTopic, byDifficulty, trend, recent } = stats;
  const hasData = summary.attempts > 0;
  const avgAccuracy = summary.answered ? Math.round((summary.correct / summary.answered) * 100) : 0;
  const incorrect = Math.max(summary.answered - summary.correct, 0);

  const streak = getStreak(user?.id);
  const badges = computeBadges({ stats, streak, topicCount: Object.keys(topics).length });
  const earnedCount = badges.filter((b) => b.earned).length;

  const meta = (slug) => topics[slug] || { name: slug, icon: '📘', color: '#6366f1' };

  const trendData = trend.map((a, i) => ({
    idx: i + 1,
    accuracy: a.accuracy,
    name: `${meta(a.slug).icon} ${meta(a.slug).name}`,
  }));
  const topicData = byTopic.map((t) => ({
    name: meta(t.slug).name,
    icon: meta(t.slug).icon,
    accuracy: t.accuracy,
    color: meta(t.slug).color,
  }));
  const donutData = [
    { name: 'Correct', value: summary.correct, color: '#0ca30c' },
    { name: 'To improve', value: incorrect, color: theme === 'dark' ? '#3a3a38' : '#e5e7eb' },
  ];
  const weakest = byTopic
    .filter((t) => t.attempts > 0)
    .reduce((lo, t) => (lo == null || t.accuracy < lo.accuracy ? t : lo), null);

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="dash-head">
        <div>
          <div className="dash-hi">Welcome back,</div>
          <h1 className="dash-name">
            <span className="gradient-text">{user?.username}</span> 👋
          </h1>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/quizzes" className="btn btn-gradient">🎯 Take a quiz</Link>
          <Link to="/flashcards" className="btn btn-ghost">🃏 Flashcards</Link>
        </div>
      </div>

      {/* Daily streak — renders whether or not there are quiz stats yet */}
      <div
        className="qb-card fade-up d-flex align-items-center gap-3 mt-4"
        style={{ padding: '1.05rem 1.3rem' }}
      >
        <div
          style={{
            flex: '0 0 auto',
            width: 56,
            height: 56,
            borderRadius: 16,
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.9rem',
            lineHeight: 1,
            background:
              streak.current > 0
                ? 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 22%, transparent), color-mix(in srgb, var(--primary) 22%, transparent))'
                : 'var(--surface-2)',
            filter: streak.current > 0 ? 'none' : 'grayscale(1)',
            opacity: streak.current > 0 ? 1 : 0.7,
          }}
        >
          🔥
        </div>
        <div className="flex-grow-1">
          {streak.current > 0 ? (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-head)',
                  fontWeight: 800,
                  fontSize: '1.25rem',
                  lineHeight: 1.1,
                }}
              >
                <span className="gradient-text">{streak.current}-day</span> streak
              </div>
              <div className="text-muted-2" style={{ fontSize: '0.85rem', marginTop: 2 }}>
                {streak.activeToday
                  ? "You've studied today — nice work! Come back tomorrow to keep it going."
                  : 'Take a quiz today to keep your streak alive.'}
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontFamily: 'var(--font-head)',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                  lineHeight: 1.15,
                }}
              >
                Start your streak — take a quiz today!
              </div>
              <div className="text-muted-2" style={{ fontSize: '0.85rem', marginTop: 2 }}>
                Study on consecutive days to build up a streak.
              </div>
            </>
          )}
        </div>
        <div className="text-end" style={{ flex: '0 0 auto' }}>
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: '1.5rem',
              lineHeight: 1,
              color: 'var(--text)',
            }}
          >
            {streak.best}
          </div>
          <div className="text-muted-2" style={{ fontSize: '0.75rem' }}>
            Best
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="qb-card p-5 text-center mt-4 fade-up">
          <div style={{ fontSize: '3rem' }}>📊</div>
          <h3 className="mt-2">No stats yet</h3>
          <p className="text-muted-2 mb-4">
            Take your first quiz and your performance metrics will appear here — accuracy trends,
            per-topic strengths, and more.
          </p>
          <Link to="/quizzes" className="btn btn-gradient btn-lg">Start your first quiz →</Link>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="row g-3 g-md-4 mt-1">
            {[
              { label: 'Quizzes taken', value: summary.attempts, icon: '🎯', suffix: '' },
              { label: 'Avg. accuracy', value: avgAccuracy, icon: '🎓', suffix: '%' },
              { label: 'Best score', value: summary.bestPct, icon: '🏆', suffix: '%' },
              { label: 'Questions answered', value: summary.answered, icon: '❓', suffix: '' },
            ].map((s) => (
              <div className="col-6 col-lg-3" key={s.label}>
                <div className="stat-tile">
                  <div className="stat-tile-icon">{s.icon}</div>
                  <div className="stat-tile-num">
                    <CountUp value={s.value} suffix={s.suffix} />
                  </div>
                  <div className="stat-tile-label">{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="row g-3 g-md-4 mt-1">
            <div className="col-12 col-lg-8">
              <div className="qb-card chart-card">
                <div className="chart-title">Accuracy trend <span>· last {trendData.length} quizzes</span></div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity={0.5} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={grid} vertical={false} />
                    <XAxis dataKey="idx" tick={{ fill: ink, fontSize: 12 }} tickLine={false} axisLine={{ stroke: grid }} />
                    <YAxis domain={[0, 100]} tick={{ fill: ink, fontSize: 12 }} tickLine={false} axisLine={false} width={38} unit="%" />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#6366f1', strokeOpacity: 0.3 }} />
                    <Area
                      type="monotone"
                      dataKey="accuracy"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#accGrad)"
                      dot={{ r: 3, fill: '#6366f1' }}
                      activeDot={{ r: 5 }}
                      animationDuration={900}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-12 col-lg-4">
              <div className="qb-card chart-card">
                <div className="chart-title">Overall accuracy</div>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={2}
                      stroke="none"
                      animationDuration={900}
                    >
                      {donutData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip suffix="" />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="donut-center">
                  <div className="donut-pct gradient-text">{avgAccuracy}%</div>
                  <div className="text-muted-2" style={{ fontSize: '0.8rem' }}>
                    {summary.correct}/{summary.answered} correct
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12 col-lg-7">
              <div className="qb-card chart-card">
                <div className="chart-title">Accuracy by topic</div>
                <ResponsiveContainer width="100%" height={Math.max(200, topicData.length * 56)}>
                  <BarChart
                    layout="vertical"
                    data={topicData}
                    margin={{ top: 6, right: 44, left: 8, bottom: 0 }}
                    barCategoryGap="28%"
                  >
                    <CartesianGrid stroke={grid} horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fill: ink, fontSize: 12 }} tickLine={false} axisLine={{ stroke: grid }} unit="%" />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fill: ink, fontSize: 13 }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
                    <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} animationDuration={900}>
                      {topicData.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                      <LabelList dataKey="accuracy" position="right" formatter={(v) => `${v}%`} style={{ fill: ink, fontSize: 12, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="col-12 col-lg-5">
              <div className="qb-card chart-card">
                <div className="chart-title">Recent activity</div>
                <div className="recent-list">
                  {recent.map((a) => {
                    const m = meta(a.slug);
                    return (
                      <div className="recent-row" key={a.id}>
                        <span className="recent-icon" style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)` }}>
                          {m.icon}
                        </span>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">{m.name}</div>
                          <div className="text-muted-2" style={{ fontSize: '0.78rem' }}>
                            <span className="text-capitalize">{a.difficulty}</span> · {relativeTime(a.created_at)}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-bold" style={{ color: DIFF_COLOR[a.difficulty] || '#6366f1' }}>
                            {a.accuracy}%
                          </div>
                          <div className="text-muted-2" style={{ fontSize: '0.75rem' }}>
                            {a.score}/{a.total}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="qb-card chart-card">
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div className="chart-title mb-0">Topic mastery</div>
                  {weakest && (
                    <Link to={`/quizzes/${weakest.slug}`} className="btn btn-gradient">
                      🎯 Practice your weakest: {meta(weakest.slug).icon} {meta(weakest.slug).name} ({weakest.accuracy}%)
                    </Link>
                  )}
                </div>
                <div className="d-flex flex-column gap-3 mt-3">
                  {byTopic.map((t) => {
                    const m = meta(t.slug);
                    return (
                      <div className="d-flex align-items-center gap-3" key={t.slug}>
                        <div className="d-flex align-items-center gap-2" style={{ minWidth: 160, flex: '0 0 160px' }}>
                          <span style={{ fontSize: '1.1rem' }}>{m.icon}</span>
                          <span className="fw-semibold text-truncate">{m.name}</span>
                        </div>
                        <div className="flex-grow-1">
                          <div
                            style={{
                              background: 'var(--surface-2)',
                              height: 10,
                              borderRadius: 999,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${t.accuracy}%`,
                                height: '100%',
                                background: m.color,
                                borderRadius: 999,
                                transition: 'width 0.9s ease',
                              }}
                            />
                          </div>
                        </div>
                        <div className="text-end" style={{ minWidth: 108, flex: '0 0 108px' }}>
                          <span className="fw-bold" style={{ color: 'var(--text)' }}>{t.accuracy}%</span>
                          <span className="ms-2" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
                            {masteryTier(t.accuracy)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Achievements */}
            <div className="col-12">
              <div className="qb-card chart-card">
                <div className="chart-title">
                  Achievements <span>· {earnedCount}/{badges.length} unlocked</span>
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '0.85rem',
                  }}
                >
                  {badges.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        position: 'relative',
                        textAlign: 'center',
                        padding: '1.05rem 0.85rem',
                        borderRadius: 14,
                        background: b.earned
                          ? 'linear-gradient(160deg, color-mix(in srgb, var(--primary) 9%, var(--surface-2)), var(--surface-2))'
                          : 'var(--surface-2)',
                        border: b.earned
                          ? '1px solid color-mix(in srgb, var(--primary) 32%, var(--border))'
                          : '1px solid var(--border)',
                        opacity: b.earned ? 1 : 0.6,
                      }}
                    >
                      {b.earned && (
                        <span
                          style={{
                            position: 'absolute',
                            top: 8,
                            right: 8,
                            width: 18,
                            height: 18,
                            borderRadius: 999,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            color: '#fff',
                            background: 'linear-gradient(135deg, var(--primary), var(--primary-2))',
                          }}
                        >
                          ✓
                        </span>
                      )}
                      <div
                        style={{
                          fontSize: '1.9rem',
                          lineHeight: 1,
                          marginBottom: '0.5rem',
                          filter: b.earned ? 'none' : 'grayscale(1)',
                        }}
                      >
                        {b.icon}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                        {b.name}
                      </div>
                      <div
                        className="text-muted-2"
                        style={{ fontSize: '0.72rem', marginTop: 3, lineHeight: 1.3 }}
                      >
                        {b.description}
                      </div>
                      {!b.earned && typeof b.progress === 'number' && (
                        <div style={{ marginTop: '0.65rem' }}>
                          <div
                            style={{
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              height: 6,
                              borderRadius: 999,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${b.progress}%`,
                                height: '100%',
                                background: 'linear-gradient(90deg, var(--primary), var(--primary-2))',
                                borderRadius: 999,
                                transition: 'width 0.9s ease',
                              }}
                            />
                          </div>
                          <div className="text-muted-2" style={{ fontSize: '0.68rem', marginTop: 3 }}>
                            {b.progress}%
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
