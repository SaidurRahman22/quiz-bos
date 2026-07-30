import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuiz, recordAttempt } from '../api.js';
import Loader from '../components/Loader.jsx';
import Bilingual from '../components/Bilingual.jsx';
import DifficultyToggle from '../components/DifficultyToggle.jsx';
import { filterByDifficulty, difficultyCounts } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';

const KEYS = ['A', 'B', 'C', 'D'];
const SESSION_SIZE = 10; // questions per play-through (drawn at random from the pool)

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

  useEffect(() => {
    setData(null);
    setError(null);
    getQuiz(slug).then(setData).catch(() => setError(true));
  }, [slug]);

  const counts = useMemo(() => (data ? difficultyCounts(data.questions) : null), [data]);

  const buildSession = useCallback(
    (lvl) => {
      if (!data) return;
      const pool = filterByDifficulty(data.questions, lvl);
      const picked = pool.slice(0, SESSION_SIZE);
      setSession(picked);
      setCurrent(0);
      setAnswers(Array(picked.length).fill(null));
      setFinished(false);
    },
    [data]
  );

  // Build the first session as soon as the data arrives.
  useEffect(() => {
    if (data) buildSession(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (error) {
    return (
      <div className="alert alert-danger">
        Could not load this quiz. <Link to="/quizzes">Back to quizzes</Link>
      </div>
    );
  }
  if (!data) return <Loader label="Loading quiz…" />;

  const { topic } = data;
  const total = session.length;
  const q = session[current];
  const selected = answers[current] ?? null; // the choice for the question on screen
  const answeredCount = answers.filter((a) => a !== null).length;
  const score = session.reduce((acc, qq, i) => acc + (answers[i] === qq.correctIndex ? 1 : 0), 0);

  const changeDifficulty = (lvl) => {
    setDifficulty(lvl);
    buildSession(lvl);
  };
  const restart = () => buildSession(difficulty);

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

  const DifficultyBar = (
    <div className="d-flex justify-content-center mb-4">
      <DifficultyToggle value={difficulty} onChange={changeDifficulty} counts={counts} />
    </div>
  );

  // ---------- Results ----------
  if (finished) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    const message =
      pct >= 90 ? 'Outstanding! 🏆' : pct >= 70 ? 'Great job! 🎉' : pct >= 50 ? 'Good effort! 👍' : 'Keep practising! 💪';
    return (
      <div className="container-narrow mx-auto text-center fade-in">
        <div className="qb-card p-5">
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
            <button className="btn btn-gradient" onClick={restart}>
              🔁 New {difficulty} set
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/quizzes')}>
              ← Other quizzes
            </button>
          </div>
        </div>
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

        <div className="d-flex justify-content-between align-items-center mt-4 gap-2 flex-wrap">
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
    </div>
  );
}
