import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getFlashcards } from '../api.js';
import Loader from '../components/Loader.jsx';
import DifficultyToggle from '../components/DifficultyToggle.jsx';
import { filterByDifficulty, difficultyCounts } from '../utils.js';

export default function FlashcardDeck() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [difficulty, setDifficulty] = useState('mix');
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(() => new Set());

  useEffect(() => {
    setData(null);
    setError(null);
    setKnown(new Set());
    getFlashcards(slug).then(setData).catch(() => setError(true));
  }, [slug]);

  const counts = useMemo(() => (data ? difficultyCounts(data.cards) : null), [data]);

  const buildDeck = useCallback(
    (lvl) => {
      if (!data) return;
      setDeck(filterByDifficulty(data.cards, lvl));
      setIndex(0);
      setFlipped(false);
    },
    [data]
  );

  useEffect(() => {
    if (data) buildDeck(difficulty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const total = deck.length;

  const go = useCallback(
    (dir) => {
      setFlipped(false);
      setIndex((i) => Math.min(Math.max(i + dir, 0), Math.max(total - 1, 0)));
    },
    [total]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setFlipped((f) => !f);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  if (error) {
    return (
      <div className="alert alert-danger">
        Could not load these flashcards. <Link to="/flashcards">Back to decks</Link>
      </div>
    );
  }
  if (!data) return <Loader label="Loading flashcards…" />;

  const { topic } = data;
  const card = deck[index];

  const changeDifficulty = (lvl) => {
    setDifficulty(lvl);
    buildDeck(lvl);
  };

  const toggleKnown = () => {
    if (!card) return;
    setKnown((prev) => {
      const s = new Set(prev);
      s.has(card.id) ? s.delete(card.id) : s.add(card.id);
      return s;
    });
  };

  const DifficultyBar = (
    <div className="d-flex justify-content-center mb-4">
      <DifficultyToggle value={difficulty} onChange={changeDifficulty} counts={counts} />
    </div>
  );

  const header = (
    <div className="d-flex align-items-center justify-content-between mb-3">
      <Link to="/flashcards" className="btn-ghost btn btn-sm">
        ← Exit
      </Link>
      <span className="pill">
        {topic.icon} {topic.name}
      </span>
      <span className="fw-semibold text-muted-2">
        {total ? index + 1 : 0} / {total}
      </span>
    </div>
  );

  if (!card) {
    return (
      <div className="container-narrow mx-auto fade-in">
        {header}
        {DifficultyBar}
        <div className="qb-card p-5 text-center text-muted-2">No flashcards available at this difficulty.</div>
      </div>
    );
  }

  const isKnown = known.has(card.id);
  const progressPct = ((index + 1) / total) * 100;

  return (
    <div className="container-narrow mx-auto fade-in">
      {header}
      {DifficultyBar}

      <div className="qb-progress mb-4">
        <div className="bar" style={{ width: `${progressPct}%` }} />
      </div>

      <div className={`flashcard ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped((f) => !f)}>
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
            <div className="back-text">{card.back}</div>
            <span className="flip-tip">tap / space to flip</span>
          </div>
        </div>
      </div>

      <div className="d-flex align-items-center justify-content-between mt-4 gap-2">
        <button className="btn btn-ghost" onClick={() => go(-1)} disabled={index === 0}>
          ← Prev
        </button>

        <button
          className={`btn ${isKnown ? 'btn-gradient' : 'btn-ghost'}`}
          onClick={toggleKnown}
          title="Mark this card as known"
        >
          {isKnown ? '✓ Known' : 'Mark known'}
        </button>

        {index + 1 >= total ? (
          <button className="btn btn-gradient" onClick={() => navigate('/flashcards')}>
            Finish →
          </button>
        ) : (
          <button className="btn btn-gradient" onClick={() => go(1)}>
            Next →
          </button>
        )}
      </div>

      <div className="text-center mt-3 text-muted-2" style={{ fontSize: '0.9rem' }}>
        Known {known.size} · use ← → keys to navigate, space to flip
      </div>
    </div>
  );
}
