import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFlashcards } from '../api.js';
import Loader from '../components/Loader.jsx';
import Bilingual from '../components/Bilingual.jsx';
import DifficultyToggle from '../components/DifficultyToggle.jsx';
import { filterByDifficulty, difficultyCounts, shuffle } from '../utils.js';
import { speak, stopSpeaking, ttsSupported } from '../tts.js';

// ── Leitner spaced-repetition config ────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
// Days until a card is due again for each box (1 = new / same session).
const BOX_DAYS = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 16 };
const MAX_BOX = 5;
const MISSED_MS = 60 * 1000; // missed cards come back almost immediately (this session)
const REQUEUE_GAP = 3; // how far ahead a missed card is re-inserted in the queue
const SESSION_SIZE = 10;

const storageKey = (slug) => `qb-srs-${slug}`;

// All localStorage access is wrapped so a disabled/full/quota-blocked store
// simply degrades to in-memory scheduling instead of crashing the app.
function loadSrs(slug) {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSrs(slug, map) {
  try {
    localStorage.setItem(storageKey(slug), JSON.stringify(map));
  } catch {
    /* storage unavailable — keep going with the in-memory copy */
  }
}

export default function FlashcardDeck() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('mix');
  const [queue, setQueue] = useState([]); // the current study session (cards)
  const [pos, setPos] = useState(0); // index into the queue
  const [flipped, setFlipped] = useState(false);
  const [srs, setSrs] = useState({}); // { [cardId]: { box, due } }
  const [stats, setStats] = useState({ reviewed: new Set(), learning: new Set() });
  const [gradedIds, setGradedIds] = useState(() => new Set()); // ids graded this session (idempotency guard)

  // Always-fresh mirrors so session building / key handling read current state
  // without forcing rebuilds on every grade.
  const srsRef = useRef({});
  const handlerRef = useRef(null);

  useEffect(() => {
    setData(null);
    setError(null);
    const loaded = loadSrs(slug);
    srsRef.current = loaded;
    setSrs(loaded);
    getFlashcards(slug).then(setData).catch(() => setError(true));
  }, [slug]);

  const counts = useMemo(() => (data ? difficultyCounts(data.cards) : null), [data]);

  // Build a ~10-card study session for the chosen difficulty, prioritising:
  //   1. due cards (lowest box, then most overdue)
  //   2. new / unseen cards
  //   3. soonest-due upcoming cards (only if still short)
  const buildSession = useCallback(
    (lvl) => {
      if (!data) return;
      const now = Date.now();
      const map = srsRef.current;
      const pool = filterByDifficulty(data.cards, lvl); // already shuffled
      const due = [];
      const fresh = [];
      const future = [];

      for (const c of pool) {
        const s = map[c.id];
        if (!s) fresh.push(c);
        else if (s.due <= now) due.push(c);
        else future.push(c);
      }

      due.sort((a, b) => {
        const sa = map[a.id];
        const sb = map[b.id];
        return sa.box - sb.box || sa.due - sb.due;
      });
      future.sort((a, b) => map[a.id].due - map[b.id].due);

      const session = [...due, ...shuffle(fresh), ...future].slice(0, SESSION_SIZE);
      setQueue(session);
      setPos(0);
      setFlipped(false);
      setStats({ reviewed: new Set(), learning: new Set() });
      setGradedIds(new Set());
    },
    [data]
  );

  useEffect(() => {
    if (data) buildSession(difficulty);
    // Difficulty changes rebuild explicitly via changeDifficulty, so we only
    // auto-build once the data arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const go = useCallback(
    (dir) => {
      stopSpeaking();
      setFlipped(false);
      setPos((p) => Math.min(Math.max(p + dir, 0), Math.max(queue.length - 1, 0)));
    },
    [queue.length]
  );

  // Stable listener that always calls the latest handler (kept in a ref).
  useEffect(() => {
    const onKey = (e) => {
      if (handlerRef.current) handlerRef.current(e);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Stop any read-aloud when the card advances (go / grade) or the deck changes,
  // and on unmount, so speech never overlaps between cards.
  useEffect(() => {
    stopSpeaking();
    return stopSpeaking;
  }, [slug, pos]);

  if (error) {
    return (
      <div className="alert alert-danger">
        Could not load these flashcards. <Link to="/flashcards">Back to decks</Link>
      </div>
    );
  }
  if (!data) return <Loader label="Loading flashcards…" />;

  const { topic } = data;
  const card = queue[pos];
  const noCards = queue.length === 0;
  const complete = queue.length > 0 && pos >= queue.length;
  const box = card ? srs[card.id]?.box || 1 : 1;
  const alreadyGraded = card ? gradedIds.has(card.id) : false;

  const changeDifficulty = (lvl) => {
    setDifficulty(lvl);
    buildSession(lvl);
  };

  // Grade the current card, update its Leitner box, persist, and advance.
  const grade = (correct) => {
    if (!card) return;
    // Idempotent per session: never re-mutate the schedule for a card the user
    // already graded (e.g. after navigating back with Prev).
    if (gradedIds.has(card.id)) return;
    setGradedIds((g) => {
      const next = new Set(g);
      next.add(card.id);
      return next;
    });
    const now = Date.now();
    const prev = srsRef.current[card.id] || { box: 1, due: 0 };
    const newBox = correct ? Math.min(prev.box + 1, MAX_BOX) : 1;
    const due = correct ? now + BOX_DAYS[newBox] * DAY_MS : now + MISSED_MS;

    const nextSrs = { ...srsRef.current, [card.id]: { box: newBox, due } };
    srsRef.current = nextSrs;
    setSrs(nextSrs);
    saveSrs(slug, nextSrs);

    setStats((s) => {
      const reviewed = new Set(s.reviewed);
      const learning = new Set(s.learning);
      if (correct) {
        reviewed.add(card.id);
        learning.delete(card.id);
      } else {
        learning.add(card.id);
      }
      return { reviewed, learning };
    });

    // Missed cards get re-queued later in the same session so they come back soon.
    if (!correct) {
      setQueue((q) => {
        const nq = [...q];
        const insertAt = Math.min(pos + REQUEUE_GAP, nq.length);
        nq.splice(insertAt, 0, card);
        return nq;
      });
    }

    setFlipped(false);
    setPos((p) => p + 1);
  };

  // Keep the key handler pointing at the current closure every render.
  handlerRef.current = (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (noCards || complete) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      setFlipped((f) => !f);
    } else if (flipped && (e.key === '1' || e.key === 'j')) grade(false);
    else if (flipped && (e.key === '2' || e.key === 'k')) grade(true);
  };

  const DifficultyBar = (
    <div className="d-flex justify-content-center mb-4">
      <DifficultyToggle value={difficulty} onChange={changeDifficulty} counts={counts} />
    </div>
  );

  const shown = Math.min(pos + 1, queue.length);
  const header = (
    <div className="d-flex align-items-center justify-content-between mb-3">
      <Link to="/flashcards" className="btn-ghost btn btn-sm">
        ← Exit
      </Link>
      <span className="pill">
        {topic.icon} {topic.name}
      </span>
      <span className="fw-semibold text-muted-2">
        {queue.length ? shown : 0} / {queue.length}
      </span>
    </div>
  );

  if (noCards) {
    return (
      <div className="container-narrow mx-auto fade-in">
        {header}
        {DifficultyBar}
        <div className="qb-card p-5 text-center text-muted-2">No flashcards available at this difficulty.</div>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="container-narrow mx-auto fade-in">
        {header}
        {DifficultyBar}
        <div className="qb-card p-5 text-center">
          <div style={{ fontSize: '2rem' }}>🎉</div>
          <h3 className="fw-bold mt-2 mb-1">Session complete</h3>
          <p className="text-muted-2 mb-4">
            Reviewed {stats.reviewed.size} · still learning {stats.learning.size}
          </p>
          <div className="d-flex gap-2 justify-content-center">
            <button className="btn btn-gradient" onClick={() => buildSession(difficulty)}>
              Another session
            </button>
            <Link to="/flashcards" className="btn btn-ghost">
              Exit
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const progressPct = queue.length ? (shown / queue.length) * 100 : 0;

  return (
    <div className="container-narrow mx-auto fade-in">
      {header}
      {DifficultyBar}

      <div className="qb-progress mb-2">
        <div className="bar" style={{ width: `${progressPct}%` }} />
      </div>
      <div className="text-center mb-3 text-muted-2" style={{ fontSize: '0.85rem' }}>
        Box {box} / {MAX_BOX}
      </div>

      <div
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        style={{ position: 'relative' }}
        onClick={() => setFlipped((f) => !f)}
      >
        {ttsSupported() && (
          <button
            className="btn btn-sm btn-ghost"
            style={{ position: 'absolute', bottom: '0.9rem', left: '1rem', zIndex: 2 }}
            // stopPropagation so reading the card aloud doesn't also flip it.
            onClick={(e) => {
              e.stopPropagation();
              speak(flipped ? card.back : card.front);
            }}
            title="Read this side aloud"
            aria-label="Read this side aloud"
          >
            🔊
          </button>
        )}
        <div className="flashcard-inner">
          <div className="flashcard-face flashcard-front">
            <span className="face-label">Question</span>
            <span className={`difficulty-tag diff-${card.difficulty} flashcard-diff`}>{card.difficulty}</span>
            <div className="front-text">{card.front}</div>
            {card.hint && <div className="hint">💡 {card.hint}</div>}
            <span className="flip-tip">tap / space to flip</span>
          </div>
          <div className="flashcard-face flashcard-back">
            <span className="face-label">Answer</span>
            <div className="back-text"><Bilingual text={card.back} /></div>
            <span className="flip-tip">tap / space to flip</span>
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-4 gap-2">
        <button className="btn btn-ghost" onClick={() => go(-1)} disabled={pos === 0}>
          ← Prev
        </button>

        {flipped ? (
          alreadyGraded ? (
            <span className="text-muted-2" style={{ fontSize: '0.85rem' }}>
              Already reviewed this session
            </span>
          ) : (
            <div className="d-flex gap-2">
              <button
                className="btn btn-ghost"
                onClick={() => grade(false)}
                title="Reset to box 1 — you'll see this card again soon"
              >
                ✗ Missed
              </button>
              <button
                className="btn btn-gradient"
                onClick={() => grade(true)}
                title="Promote this card to the next box"
              >
                ✓ Got it
              </button>
            </div>
          )
        ) : (
          <button className="btn btn-gradient" onClick={() => setFlipped(true)}>
            Show answer
          </button>
        )}

        <button className="btn btn-ghost" onClick={() => go(1)} disabled={pos + 1 >= queue.length}>
          Next →
        </button>
      </div>

      <div className="text-center mt-3 text-muted-2" style={{ fontSize: '0.9rem' }}>
        Reviewed {stats.reviewed.size} · learning {stats.learning.size}
      </div>
      <div className="text-center mt-1 text-muted-2" style={{ fontSize: '0.8rem' }}>
        ← → navigate · space flip · <kbd>1</kbd>/<kbd>j</kbd> missed · <kbd>2</kbd>/<kbd>k</kbd> got it
      </div>
    </div>
  );
}
