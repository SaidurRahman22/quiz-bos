import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTopics } from '../api.js';
import TopicCard from '../components/TopicCard.jsx';
import Loader from '../components/Loader.jsx';

export default function Home() {
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopics().then(setTopics).catch(() => setError(true));
  }, []);

  const totalQuiz = topics?.reduce((s, t) => s + t.quizCount, 0) ?? 0;
  const totalCards = topics?.reduce((s, t) => s + t.flashcardCount, 0) ?? 0;

  return (
    <div className="fade-in">
      <section className="hero">
        <span className="hero-badge">⚡ No login required · jump right in</span>
        <h1 className="mt-4">
          Master any topic with <span className="gradient-text">Quiz Boss</span>
        </h1>
        <p>
          Sharpen your knowledge across Nursing, General Knowledge, English and World Geo Politics.
          Take interactive quizzes or flip through study flashcards — beautifully.
        </p>
        <div className="d-flex gap-3 justify-content-center flex-wrap">
          <Link to="/quizzes" className="btn btn-gradient btn-lg">
            🎯 Start a Quiz
          </Link>
          <Link to="/flashcards" className="btn btn-ghost btn-lg">
            🃏 Study Flashcards
          </Link>
        </div>

        {topics && (
          <div className="stat-row">
            <div className="stat">
              <div className="num">{totalQuiz}</div>
              <div className="label">Quiz Questions</div>
            </div>
            <div className="stat">
              <div className="num">{totalCards}</div>
              <div className="label">Flashcards</div>
            </div>
            <div className="stat">
              <div className="num">{topics.length}</div>
              <div className="label">Topics</div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-4">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="mb-0">Browse topics</h3>
          <Link to="/quizzes" className="text-decoration-none fw-semibold">
            View all →
          </Link>
        </div>

        {error && (
          <div className="alert alert-danger">
            Could not reach the API. Make sure the backend is running on port 4000
            (<code>cd server &amp;&amp; npm start</code>).
          </div>
        )}
        {!topics && !error && <Loader label="Loading topics…" />}

        {topics && (
          <div className="row g-4">
            {topics.map((t) => (
              <div className="col-12 col-sm-6 col-lg-3" key={t.id}>
                <TopicCard topic={t} mode="quiz" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
