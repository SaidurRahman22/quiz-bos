import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuiz, recordAttempt, reportQuestion } from '../api.js';
import Loader from '../components/Loader.jsx';
import Bilingual from '../components/Bilingual.jsx';
import DifficultyToggle from '../components/DifficultyToggle.jsx';
import { filterByDifficulty, difficultyCounts, shuffle } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';

const KEYS = ['A', 'B', 'C', 'D'];
const SESSION_SIZE = 10; // questions per play-through (drawn at random from the pool)

// Shuffle a question's options each attempt so people learn the answer, not "always C".
// correctIndex is remapped to wherever the correct option lands; id/question/explanation
// are preserved (id keeps "report this question" and retry-wrong working).
function shuffleOptions(q) {
  const order = shuffle(q.options.map((_, i) => i));
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correctIndex: order.indexOf(q.correctIndex),
  };
}

export default function QuizPlay() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('mix');
  const [session, setSession] = useState([]);
  const [current, setCurrent] = useState(0);
  // answers[i] = the option index the user chose for question i (null = unanswered).
  // Storing the actual choice per question (not just correctness) is what lets the
  // user go Previous/Next and review their earlier answer + explanation.
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  // Question ids the user has flagged as wrong (optimistic; rolled back if the POST fails).
  const [reported, setReported] = useState(() => new Set());

  useEffect(() => {
    setData(null);
    setError(null);
    getQuiz(slug).then(setData).catch(() => setError(true));
  }, [slug]);

  const counts = useMemo(() => (data ? difficultyCounts(data.questions) : null), [data]);

  const startSession = useCallback((picked) => {
    setSession(picked);
    setCurrent(0);
    setAnswers(Array(picked.length).fill(null));
    setFinished(false);
    setReported(new Set());
  }, []);

  const buildSession = useCallback(
    (lvl) => {
      if (!data) return;
      // filterByDifficulty already shuffles the pool; we then shuffle each question's
      // options so option order is randomized every attempt.
      const pool = filterByDifficulty(data.questions, lvl);
      startSession(pool.slice(0, SESSION_SIZE).map(shuffleOptions));
    },
    [data, startSession]
  );

  // Build the first session as soon as the data arrives.
  useEffect(() => {
    if (data) buildSession(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ---------- Derived (safe even before data loads: session is []) ----------
  const total = session.length;
  const q = session[current];
  const selected = answers[current] ?? null; // the choice for the question on screen
  const answeredCount = answers.filter((a) => a !== null).length;
  const score = session.reduce((acc, qq, i) => acc + (answers[i] === qq.correctIndex ? 1 : 0), 0);

  // ---------- Handlers ----------
  const changeDifficulty = (lvl) => {
    setDifficulty(lvl);
    buildSession(lvl);
  };
  const restart = () => buildSession(difficulty);

  // Rebuild a fresh session from only the questions the user got wrong, re-shuffling
  // their options so it's a genuine retry rather than a memory test of positions.
  const retryWrong = () => {
    const wrong = session.filter((qq, i) => answers[i] !== qq.correctIndex);
    if (wrong.length) startSession(wrong.map(shuffleOptions));
  };

  const choose = (idx) => {
    if (answers[current] !== null) return; // already answered — review only, never overwrite
    setAnswers((prev) => {
      const copy = [...prev];
      copy[current] = idx;
      return copy;
    });
  };

  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  const next = () => {
    if (current + 1 >= total) {
      setFinished(true);
      // Record the completed attempt for logged-in users (fire-and-forget).
      if (user && total > 0) {
        recordAttempt({ topicSlug: slug, difficulty, score, total }).catch(() => {});
      }
    } else {
      setCurrent((c) => c + 1);
    }
  };

  // Flag a question as wrong/broken. Optimistic: mark it reported immediately, and roll
  // back only if the request fails so the user can try again.
  const report = (qq) => {
    if (!qq || reported.has(qq.id)) return;
    setReported((prevSet) => new Set(prevSet).add(qq.id));
    reportQuestion({ topicSlug: slug, questionId: qq.id }).catch(() => {
      setReported((prevSet) => {
        const s = new Set(prevSet);
        s.delete(qq.id);
        return s;
      });
    });
  };

  // ---------- Keyboard controls (feature: answer with A–D / 1–4, move with ← →) ----------
  // No dependency array: re-subscribes each render so the handler always sees fresh state.
  // Guarded so it never fires on the results screen or while typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if (finished || !q) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;
      // A/B/C/D or 1..4 selects an option — only while the question is unanswered.
      let idx = -1;
      const up = k.length === 1 ? k.toUpperCase() : k;
      if (KEYS.includes(up)) idx = KEYS.indexOf(up);
      else if (/^[1-9]$/.test(k)) idx = Number(k) - 1;

      if (idx >= 0) {
        if (idx < q.options.length && selected === null) {
          e.preventDefault();
          choose(idx);
        }
        return;
      }

      if (k === 'ArrowRight' || k === 'Enter') {
        if (selected !== null) {
          e.preventDefault();
          next();
        }
      } else if (k === 'ArrowLeft') {
        if (current > 0) {
          e.preventDefault();
          prev();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (error) {
    return (
      <div className="alert alert-danger">
        Could not load this quiz. <Link to="/quizzes">Back to quizzes</Link>
      </div>
    );
  }
  if (!data) return <Loader label="Loading quiz…" />;

  const { topic } = data;

  const DifficultyBar = (
    <div className="d-flex justify-content-center mb-4">
      <DifficultyToggle value={difficulty} onChange={changeDifficulty} counts={counts} />
    </div>
  );

  const ReportButton = ({ qq }) => (
    <button
      className="btn btn-sm btn-ghost"
      onClick={() => report(qq)}
      disabled={reported.has(qq.id)}
      title="Report a problem with this question"
    >
      {reported.has(qq.id) ? '✓ Reported' : '⚠️ Report'}
    </button>
  );

  // ---------- Results ----------
  if (finished) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    const message =
      pct >= 90 ? 'Outstanding! 🏆' : pct >= 70 ? 'Great job! 🎉' : pct >= 50 ? 'Good effort! 👍' : 'Keep practising! 💪';
    // Everything the user missed (unanswered counts as missed), for the review list.
    const wrong = session
      .map((qq, i) => ({ qq, chosen: answers[i] }))
      .filter(({ qq, chosen }) => chosen !== qq.correctIndex);

    return (
      <div className="container-narrow mx-auto fade-in">
        <div className="qb-card p-5 text-center">
          <h2 className="mb-1">Quiz complete</h2>
          <p className="text-muted-2 mb-4">
            {topic.icon} {topic.name} · <span className="text-capitalize">{difficulty}</span>
          </p>
          <div className="score-ring mb-4" style={{ '--pct': `${pct}%` }}>
            <div className="inner">
              <div className="pct">{pct}%</div>
              <div className="text-muted-2">
                {score}/{total}
              </div>
            </div>
          </div>
          <h4 className="mb-4">{message}</h4>
          <div className="d-flex gap-3 justify-content-center flex-wrap">
            {wrong.length > 0 && (
              <button className="btn btn-gradient" onClick={retryWrong}>
                🎯 Retry wrong ({wrong.length})
              </button>
            )}
            <button className="btn btn-ghost" onClick={restart}>
              🔁 New {difficulty} set
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/quizzes')}>
              ← Other quizzes
            </button>
          </div>
        </div>

        {/* ---------- Review wrong answers ---------- */}
        {wrong.length > 0 && (
          <div className="mt-4">
            <h5 className="mb-3">Review · {wrong.length} to revisit</h5>
            {wrong.map(({ qq, chosen }) => (
              <div className="qb-card p-4 mb-3" key={qq.id}>
                <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                  <strong className="flex-grow-1">{qq.question}</strong>
                  <span className={`difficulty-tag diff-${qq.difficulty}`}>{qq.difficulty}</span>
                </div>
                <div style={{ color: 'var(--bs-danger, #dc3545)' }}>
                  ❌ Your answer: {chosen !== null ? qq.options[chosen] : <em>Not answered</em>}
                </div>
                <div style={{ color: 'var(--bs-success, #16a34a)' }}>
                  ✅ Correct answer: {qq.options[qq.correctIndex]}
                </div>
                {qq.explanation && (
                  <div className="explanation mt-2">
                    <Bilingual text={qq.explanation} />
                  </div>
                )}
                <div className="text-end mt-2">
                  <ReportButton qq={qq} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---------- No questions at this level ----------
  if (!q) {
    return (
      <div className="container-narrow mx-auto fade-in">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <Link to="/quizzes" className="btn-ghost btn btn-sm">
            ← Exit
          </Link>
          <span className="pill">
            {topic.icon} {topic.name}
          </span>
          <span />
        </div>
        {DifficultyBar}
        <div className="qb-card p-5 text-center text-muted-2">No questions available at this difficulty.</div>
      </div>
    );
  }

  // ---------- Question ----------
  const progressPct = total ? (answeredCount / total) * 100 : 0;

  return (
    <div className="container-narrow mx-auto fade-in">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <Link to="/quizzes" className="btn-ghost btn btn-sm">
          ← Exit
        </Link>
        <span className="pill">
          {topic.icon} {topic.name}
        </span>
        <span className="fw-semibold text-muted-2">
          {current + 1} / {total}
        </span>
      </div>

      {DifficultyBar}

      <div className="qb-progress mb-4">
        <div className="bar" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="qb-card p-4 p-md-5">
        <div className="d-flex justify-content-between align-items-start mb-3 gap-2">
          <h4 className="mb-0 flex-grow-1">{q.question}</h4>
          <span className={`difficulty-tag diff-${q.difficulty}`}>{q.difficulty}</span>
        </div>

        <div className="mt-4">
          {q.options.map((opt, idx) => {
            let cls = 'option-btn';
            if (selected !== null) {
              if (idx === q.correctIndex) cls += ' correct';
              else if (idx === selected) cls += ' wrong';
            }
            return (
              <button key={idx} className={cls} disabled={selected !== null} onClick={() => choose(idx)}>
                <span className="key">{KEYS[idx]}</span>
                <span>{opt}</span>
                {selected !== null && idx === q.correctIndex && <span className="ms-auto">✅</span>}
                {selected !== null && idx === selected && idx !== q.correctIndex && <span className="ms-auto">❌</span>}
              </button>
            );
          })}
        </div>

        {selected !== null && (
          <div className="explanation mt-3">
            <strong>{selected === q.correctIndex ? 'Correct! ' : 'Not quite. '}</strong>
            <Bilingual text={q.explanation} />
          </div>
        )}

        <div className="d-flex justify-content-end mt-3">
          <ReportButton qq={q} />
        </div>

        <div className="d-flex justify-content-between align-items-center mt-3 gap-2 flex-wrap">
          <button className="btn btn-ghost" onClick={prev} disabled={current === 0}>
            ← Previous
          </button>
          <span className="text-muted-2">
            Score: <strong>{score}</strong> / {answeredCount}
          </span>
          {selected !== null ? (
            <button className="btn btn-gradient" onClick={next}>
              {current + 1 >= total ? 'See results →' : 'Next →'}
            </button>
          ) : (
            <button className="btn btn-gradient" disabled title="Choose an answer to continue">
              Next →
            </button>
          )}
        </div>
      </div>

      <div className="text-center mt-3 text-muted-2" style={{ fontSize: '0.9rem' }}>
        Keys: <strong>A–D</strong> to answer · <strong>← →</strong> to move
      </div>
    </div>
  );
}
