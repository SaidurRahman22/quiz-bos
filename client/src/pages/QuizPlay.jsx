import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuiz, recordAttempt } from '../api.js';
import Loader from '../components/Loader.jsx';
import DifficultyToggle from '../components/DifficultyToggle.jsx';
import { filterByDifficulty, difficultyCounts } from '../utils.js';
import { useAuth } from '../context/AuthContext.jsx';

const KEYS = ['A', 'B', 'C', 'D'];
const SESSION_SIZE = 15; // questions per play-through (drawn at random from the pool)

export default function QuizPlay() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('mix');
  const [session, setSession] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
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
      setSession(pool.slice(0, SESSION_SIZE));
      setCurrent(0);
      setSelected(null);
      setAnswers([]);
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
  const score = answers.filter((a) => a.correct).length;

  const changeDifficulty = (lvl) => {
    setDifficulty(lvl);
    buildSession(lvl);
  };
  const restart = () => buildSession(difficulty);

  const choose = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    setAnswers((prev) => [...prev, { correct: idx === q.correctIndex }]);
  };

  const next = () => {
    if (current + 1 >= total) {
      setFinished(true);
      // Record the completed attempt for logged-in users (fire-and-forget).
      if (user && total > 0) {
        recordAttempt({ topicSlug: slug, difficulty, score, total }).catch(() => {});
      }
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
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
  const progressPct = ((current + (selected !== null ? 1 : 0)) / total) * 100;

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
          <>
            <div className="explanation mt-3">
              <strong>{selected === q.correctIndex ? 'Correct! ' : 'Not quite. '}</strong>
              {q.explanation}
            </div>
            <div className="d-flex justify-content-between align-items-center mt-4">
              <span className="text-muted-2">
                Score: <strong>{score}</strong> / {answers.length}
              </span>
              <button className="btn btn-gradient" onClick={next}>
                {current + 1 >= total ? 'See results →' : 'Next question →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
