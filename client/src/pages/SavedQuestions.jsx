import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getSavedQuestions, unsaveQuestion } from '../api.js';
import Loader from '../components/Loader.jsx';
import Bilingual from '../components/Bilingual.jsx';

export default function SavedQuestions() {
  const { user, ready } = useAuth();
  const [saved, setSaved] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user) return;
    getSavedQuestions()
      .then(setSaved)
      .catch(() => setError(true));
  }, [user]);

  if (!ready) return <Loader label="Loading…" />;
  if (!user) return <Navigate to="/login" replace />;

  const handleRemove = async (questionId) => {
    const prev = saved;
    setSaved((list) => list.filter((q) => q.questionId !== questionId));
    try {
      await unsaveQuestion(questionId);
    } catch {
      setSaved(prev); // roll back on error
    }
  };

  return (
    <div className="container-narrow mx-auto fade-in">
      <div className="text-center mb-4">
        <h1 className="mb-2">⭐ Saved questions</h1>
      </div>

      {error && <div className="alert alert-danger">Could not load your saved questions. Please try again.</div>}
      {!saved && !error && <Loader label="Loading…" />}

      {saved && saved.length === 0 && (
        <div className="qb-card p-5 text-center text-muted-2">
          <p className="mb-3">You haven't saved any questions yet.</p>
          <p className="mb-3">Tap ⭐ on any quiz question to save it here for later review.</p>
          <Link to="/quizzes" className="btn btn-gradient">Browse quizzes</Link>
        </div>
      )}

      {saved &&
        saved.map((q) => (
          <div className="qb-card p-4 mb-3" key={q.questionId}>
            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
              <strong>
                <Bilingual text={q.question} />
              </strong>
              <span className={`difficulty-tag diff-${q.difficulty}`}>{q.difficulty}</span>
            </div>

            <ul className="list-unstyled mb-2">
              {q.options.map((opt, i) => {
                const correct = i === q.correctIndex;
                return (
                  <li
                    key={i}
                    className="mb-1"
                    style={correct ? { color: 'var(--bs-success,#16a34a)', fontWeight: 600 } : undefined}
                  >
                    {correct ? '✅ ' : '• '}
                    <Bilingual text={opt} />
                  </li>
                );
              })}
            </ul>

            {q.explanation && (
              <div className="text-muted-2 mb-3" style={{ fontSize: '0.9rem' }}>
                <Bilingual text={q.explanation} />
              </div>
            )}

            <button className="btn btn-sm btn-ghost" onClick={() => handleRemove(q.questionId)}>
              🗑 Remove
            </button>
          </div>
        ))}
    </div>
  );
}
