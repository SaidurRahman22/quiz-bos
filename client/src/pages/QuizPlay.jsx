import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getQuiz,
  recordAttempt,
  reportQuestion,
  getSavedQuestions,
  saveQuestion,
  unsaveQuestion,
} from '../api.js';
import Loader from '../components/Loader.jsx';
import Bilingual from '../components/Bilingual.jsx';
import DifficultyToggle from '../components/DifficultyToggle.jsx';
import { filterByDifficulty, difficultyCounts, shuffle } from '../utils.js';
import { speak, stopSpeaking, ttsSupported } from '../tts.js';
import { recordStudyActivity } from '../streak.js';
import { shareScoreCard } from '../shareCard.js';
import { useAuth } from '../context/AuthContext.jsx';

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F']; // supports up to 6 options (admin questions)
const DEFAULT_SIZE = 10; // questions per play-through when the user hasn't picked a size
const SIZES = [10, 20, 50]; // adjustable session size
const EXAM_SECONDS_PER_Q = 60; // exam mode: one minute per question

// Shuffle a question's options each attempt so people learn the answer, not "always C".
// correctIndex is remapped to wherever the correct option lands; id/question/explanation
// are preserved (id keeps "report" / "save" / retry-wrong working).
function shuffleOptions(q) {
  const order = shuffle(q.options.map((_, i) => i));
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    correctIndex: order.indexOf(q.correctIndex),
  };
}

function fmtTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Small segmented pill control (reuses the difficulty-toggle styling). Defined at MODULE
// scope on purpose: an inline component would get a new identity on every render, so React
// would unmount/remount the whole controls bar each time you answered — causing the
// flicker / page-jump. A stable identity lets it reconcile in place.
function Segmented({ label, options, value, onChange }) {
  return (
    <div className="d-flex flex-column flex-sm-row align-items-center gap-1 gap-sm-2">
      <span className="text-muted-2" style={{ fontSize: '0.85rem' }}>
        {label}
      </span>
      <div className="difficulty-toggle" role="tablist" aria-label={label}>
        {options.map((o) => (
          <button
            key={String(o.value)}
            role="tab"
            aria-selected={value === o.value}
            className={`dt-btn ${value === o.value ? 'active' : ''}`}
            onClick={() => onChange(o.value)}
            title={o.title || o.label}
          >
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function QuizPlay() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('mix');
  const [mode, setMode] = useState('practice'); // 'practice' | 'exam'
  const [size, setSize] = useState(DEFAULT_SIZE); // 10 | 20 | 50 | 'all'
  const [session, setSession] = useState([]);
  const [current, setCurrent] = useState(0);
  // answers[i] = the option index chosen for question i (null = unanswered). Storing the
  // actual choice (not just correctness) powers Previous/Next, review, and exam re-answers.
  const [answers, setAnswers] = useState([]);
  const [finished, setFinished] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null); // exam countdown; null in practice
  const [reported, setReported] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());
  const [savingIds, setSavingIds] = useState(() => new Set()); // bookmark toggles in flight
  const [built, setBuilt] = useState(false); // first session for the current topic is ready
  const [shareStatus, setShareStatus] = useState('');
  // Guards recordAttempt / setFinished against firing twice (e.g. submit + timeout race).
  const finishedRef = useRef(false);

  useEffect(() => {
    setData(null);
    setError(null);
    setBuilt(false); // don't show a stale/empty session while the new topic loads
    getQuiz(slug).then(setData).catch(() => setError(true));
  }, [slug]);

  // Load which questions this user has already bookmarked, so the ⭐ reflects reality.
  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      return;
    }
    getSavedQuestions()
      .then((list) => setSavedIds(new Set(list.map((s) => s.questionId))))
      .catch(() => {});
  }, [user]);

  const counts = useMemo(() => (data ? difficultyCounts(data.questions) : null), [data]);

  const startSession = useCallback((picked, examSeconds) => {
    finishedRef.current = false;
    setSession(picked);
    setCurrent(0);
    setAnswers(Array(picked.length).fill(null));
    setFinished(false);
    setReported(new Set());
    setSecondsLeft(examSeconds);
    setBuilt(true);
  }, []);

  const buildSession = useCallback(
    (lvl, sz, md) => {
      if (!data) return;
      // filterByDifficulty already shuffles the pool; then shuffle each question's options.
      const pool = filterByDifficulty(data.questions, lvl);
      const limit = sz === 'all' ? pool.length : sz;
      const picked = pool.slice(0, limit).map(shuffleOptions);
      // No timer for an empty pool — otherwise secondsLeft=0 would instantly "finish".
      startSession(picked, md === 'exam' && picked.length ? picked.length * EXAM_SECONDS_PER_Q : null);
    },
    [data, startSession]
  );

  // Build the first session as soon as the data arrives.
  useEffect(() => {
    if (data) buildSession(difficulty, size, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // ---------- Derived (safe before data loads: session is []) ----------
  const total = session.length;
  const q = session[current];
  const selected = answers[current] ?? null;
  const answeredCount = answers.filter((a) => a !== null).length;
  const score = session.reduce((acc, qq, i) => acc + (answers[i] === qq.correctIndex ? 1 : 0), 0);
  const isExam = mode === 'exam';
  // Reveal correctness/explanation only in practice mode after answering (exam hides it).
  const reveal = !isExam && selected !== null;

  // ---------- Handlers ----------
  // Changing difficulty/size/mode rebuilds the set — confirm first if answers are in
  // progress so a stray tap can't wipe progress (or silently reset the exam timer).
  const confirmRebuild = () =>
    answeredCount === 0 || finished || window.confirm('Start a new set? Your current progress will be lost.');

  const changeDifficulty = (lvl) => {
    if (lvl === difficulty || !confirmRebuild()) return;
    setDifficulty(lvl);
    buildSession(lvl, size, mode);
  };
  const changeSize = (sz) => {
    if (sz === size || !confirmRebuild()) return;
    setSize(sz);
    buildSession(difficulty, sz, mode);
  };
  const changeMode = (md) => {
    if (md === mode || !confirmRebuild()) return;
    setMode(md);
    buildSession(difficulty, size, md);
  };
  const restart = () => buildSession(difficulty, size, mode);

  const retryWrong = () => {
    const wrong = session.filter((qq, i) => answers[i] !== qq.correctIndex);
    if (wrong.length) startSession(wrong.map(shuffleOptions), isExam ? wrong.length * EXAM_SECONDS_PER_Q : null);
  };

  // Share a branded score card (image via Web Share on mobile; download + copied caption otherwise).
  const share = async () => {
    setShareStatus('…');
    const result = await shareScoreCard({
      topicName: data?.topic?.name || 'Quiz',
      topicIcon: data?.topic?.icon,
      score,
      total,
    });
    setShareStatus(
      result === 'shared'
        ? '✓ Shared!'
        : result === 'downloaded'
          ? '📥 Saved image + copied caption'
          : result === 'unsupported'
            ? 'Sharing isn’t supported on this device'
            : ''
    );
  };

  const choose = (idx) => {
    // Practice: lock the answer once chosen (review only). Exam: allow changing it.
    if (!isExam && answers[current] !== null) return;
    setAnswers((prev) => {
      const copy = [...prev];
      copy[current] = idx;
      return copy;
    });
  };

  const finishQuiz = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    recordStudyActivity(user?.id); // advance the daily study streak (once per day)
    if (user && session.length > 0) {
      const finalScore = session.reduce((acc, qq, i) => acc + (answers[i] === qq.correctIndex ? 1 : 0), 0);
      recordAttempt({ topicSlug: slug, difficulty, score: finalScore, total: session.length }).catch(() => {});
    }
  }, [user, session, answers, slug, difficulty]);

  // Keep the latest finishQuiz in a ref so the countdown effect below doesn't list it as a
  // dependency. finishQuiz's identity changes whenever `answers` changes, so depending on
  // it would clear+restart the 1s timer on every answer and stall the exam countdown.
  const finishQuizRef = useRef(finishQuiz);
  finishQuizRef.current = finishQuiz;

  const prev = () => setCurrent((c) => Math.max(c - 1, 0));
  const next = () => {
    if (current + 1 >= total) finishQuiz();
    else setCurrent((c) => c + 1);
  };

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

  // Toggle a bookmark. Optimistic; rolls back if the request fails. Requires login.
  const toggleSave = (qq) => {
    if (!qq) return;
    if (!user) {
      navigate('/login');
      return;
    }
    if (savingIds.has(qq.id)) return; // a toggle for this question is already in flight
    const wasSaved = savedIds.has(qq.id);
    setSavingIds((prevSet) => new Set(prevSet).add(qq.id));
    setSavedIds((prevSet) => {
      const s = new Set(prevSet);
      wasSaved ? s.delete(qq.id) : s.add(qq.id);
      return s;
    });
    const rollback = () =>
      setSavedIds((prevSet) => {
        const s = new Set(prevSet);
        wasSaved ? s.add(qq.id) : s.delete(qq.id);
        return s;
      });
    const req = wasSaved
      ? unsaveQuestion(qq.id)
      : saveQuestion({
          questionId: qq.id,
          topicSlug: slug,
          question: qq.question,
          options: qq.options,
          correctIndex: qq.correctIndex,
          explanation: qq.explanation,
          difficulty: qq.difficulty,
        });
    req
      .catch(rollback)
      .finally(() =>
        setSavingIds((prevSet) => {
          const s = new Set(prevSet);
          s.delete(qq.id);
          return s;
        })
      );
  };

  // ---------- Exam countdown ----------
  useEffect(() => {
    if (!isExam || finished || secondsLeft == null) return undefined;
    if (secondsLeft <= 0) {
      finishQuizRef.current();
      return undefined;
    }
    const id = setTimeout(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearTimeout(id);
  }, [isExam, finished, secondsLeft]);

  // ---------- Keyboard: A–D / 1–4 to answer, ← → to move, Enter to advance ----------
  useEffect(() => {
    const onKey = (e) => {
      if (finished || !q) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key;
      let idx = -1;
      const up = k.length === 1 ? k.toUpperCase() : k;
      if (KEYS.includes(up)) idx = KEYS.indexOf(up);
      else if (/^[1-9]$/.test(k)) idx = Number(k) - 1;

      if (idx >= 0) {
        // Exam: always selectable (answers can change). Practice: only while unanswered.
        if (idx < q.options.length && (isExam || selected === null)) {
          e.preventDefault();
          choose(idx);
        }
        return;
      }

      if (k === 'ArrowRight' || k === 'Enter') {
        // Exam lets you skip ahead; practice requires an answer first (mirrors the button).
        if (isExam || selected !== null) {
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

  // Stop any read-aloud when the visible question changes or on unmount so
  // speech never overlaps between questions.
  useEffect(() => {
    stopSpeaking();
    return stopSpeaking;
  }, [current]);

  if (error) {
    return (
      <div className="alert alert-danger">
        Could not load this quiz. <Link to="/quizzes">Back to quizzes</Link>
      </div>
    );
  }
  if (!data) return <Loader label="Loading quiz…" />;
  // The first session is built in an effect after data arrives; gate on `built` so we never
  // flash "No questions available" for a topic that actually has questions.
  if (!built) return <Loader label="Loading quiz…" />;

  const { topic } = data;

  const Controls = (
    <div className="d-flex flex-column align-items-center gap-3 mb-4">
      <DifficultyToggle value={difficulty} onChange={changeDifficulty} counts={counts} />
      <div className="d-flex justify-content-center gap-3 gap-md-4 flex-wrap">
        <Segmented
          label="Mode"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'practice', label: '📖 Practice' },
            { value: 'exam', label: '⏱️ Exam' },
          ]}
        />
        <Segmented
          label="Questions"
          value={size}
          onChange={changeSize}
          options={SIZES.map((s) => ({ value: s, label: String(s) }))}
        />
      </div>
    </div>
  );

  const actionRow = (qq) => (
    <div className="d-flex justify-content-end gap-2">
      <button
        className={`btn btn-sm ${savedIds.has(qq.id) ? 'btn-gradient' : 'btn-ghost'}`}
        onClick={() => toggleSave(qq)}
        disabled={savingIds.has(qq.id)}
        title={user ? 'Save this question to your ⭐ deck' : 'Log in to save questions'}
      >
        {savedIds.has(qq.id) ? '⭐ Saved' : '☆ Save'}
      </button>
      <button
        className="btn btn-sm btn-ghost"
        onClick={() => report(qq)}
        disabled={reported.has(qq.id)}
        title="Report a problem with this question"
      >
        {reported.has(qq.id) ? '✓ Reported' : '⚠️ Report'}
      </button>
    </div>
  );

  // ---------- Results ----------
  if (finished) {
    const pct = total ? Math.round((score / total) * 100) : 0;
    const message =
      pct >= 90 ? 'Outstanding! 🏆' : pct >= 70 ? 'Great job! 🎉' : pct >= 50 ? 'Good effort! 👍' : 'Keep practising! 💪';
    const wrong = session
      .map((qq, i) => ({ qq, chosen: answers[i] }))
      .filter(({ qq, chosen }) => chosen !== qq.correctIndex);

    return (
      <div className="container-narrow mx-auto fade-in">
        <div className="qb-card p-5 text-center">
          <h2 className="mb-1">{isExam ? 'Exam complete' : 'Quiz complete'}</h2>
          <p className="text-muted-2 mb-4">
            {topic.icon} {topic.name} · <span className="text-capitalize">{difficulty}</span> ·{' '}
            {isExam ? '⏱️ Exam' : '📖 Practice'}
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
              🔁 New set
            </button>
            <button className="btn btn-ghost" onClick={() => navigate('/quizzes')}>
              ← Other quizzes
            </button>
          </div>
          <div className="mt-3">
            <button className="btn btn-gradient" onClick={share}>
              📤 Share score
            </button>
            {shareStatus && (
              <div className="text-muted-2 mt-2" style={{ fontSize: '0.85rem' }}>
                {shareStatus}
              </div>
            )}
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
                <div className="mt-2">{actionRow(qq)}</div>
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
        {Controls}
        <div className="qb-card p-5 text-center text-muted-2">No questions available at this difficulty.</div>
      </div>
    );
  }

  // ---------- Question ----------
  const progressPct = total ? (answeredCount / total) * 100 : 0;
  const lowTime = isExam && secondsLeft != null && secondsLeft <= 30;

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

      {Controls}

      {isExam && secondsLeft != null && (
        <div className="d-flex flex-column flex-sm-row align-items-center justify-content-sm-between text-center mb-3 gap-2">
          <span
            className="pill"
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: lowTime ? '#dc2626' : undefined,
              borderColor: lowTime ? '#dc2626' : undefined,
            }}
          >
            ⏱️ {fmtTime(secondsLeft)}
          </span>
          <span className="text-muted-2" style={{ fontSize: '0.85rem' }}>
            Answered {answeredCount} / {total} · no feedback until you submit
          </span>
          <button className="btn btn-sm btn-gradient" onClick={finishQuiz}>
            Submit exam
          </button>
        </div>
      )}

      <div className="qb-progress mb-4">
        <div className="bar" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="qb-card p-4 p-md-5">
        <div className="d-flex justify-content-between align-items-start mb-3 gap-2">
          <h4 className="mb-0 flex-grow-1">{q.question}</h4>
          {ttsSupported() && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => speak(q.question)}
              title="Read the question aloud"
              aria-label="Read the question aloud"
            >
              🔊
            </button>
          )}
          <span className={`difficulty-tag diff-${q.difficulty}`}>{q.difficulty}</span>
        </div>

        <div className="mt-4">
          {q.options.map((opt, idx) => {
            let cls = 'option-btn';
            if (reveal) {
              if (idx === q.correctIndex) cls += ' correct';
              else if (idx === selected) cls += ' wrong';
            } else if (isExam && idx === selected) {
              cls += ' chosen';
            }
            return (
              <button key={idx} className={cls} disabled={reveal} onClick={() => choose(idx)}>
                <span className="key">{KEYS[idx]}</span>
                <span>{opt}</span>
                {reveal && idx === q.correctIndex && <span className="ms-auto">✅</span>}
                {reveal && idx === selected && idx !== q.correctIndex && <span className="ms-auto">❌</span>}
                {!reveal && isExam && idx === selected && <span className="ms-auto">●</span>}
              </button>
            );
          })}
        </div>

        {reveal && (
          <div className="explanation mt-3">
            <strong>{selected === q.correctIndex ? 'Correct! ' : 'Not quite. '}</strong>
            <Bilingual text={q.explanation} />
          </div>
        )}

        <div className="mt-3">{actionRow(q)}</div>

        <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center justify-content-sm-between mt-3 gap-2">
          <button className="btn btn-ghost" onClick={prev} disabled={current === 0}>
            ← Previous
          </button>
          <span className="text-muted-2 text-center">
            {isExam ? (
              <>
                Answered <strong>{answeredCount}</strong> / {total}
              </>
            ) : (
              <>
                Score: <strong>{score}</strong> / {answeredCount}
              </>
            )}
          </span>
          {isExam || selected !== null ? (
            <button className="btn btn-gradient" onClick={next}>
              {current + 1 >= total ? (isExam ? 'Submit exam →' : 'See results →') : 'Next →'}
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
