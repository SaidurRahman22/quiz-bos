import { useEffect, useState } from 'react';
import { getTopics } from '../api.js';
import TopicCard from '../components/TopicCard.jsx';
import Loader from '../components/Loader.jsx';

export default function FlashcardTopics() {
  const [topics, setTopics] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTopics().then(setTopics).catch(() => setError(true));
  }, []);

  return (
    <div className="fade-in">
      <div className="text-center mb-4">
        <h1 className="mb-2">
          🃏 <span className="gradient-text">Flashcards</span>
        </h1>
        <p className="text-muted-2">Flip through study cards to memorize key facts across every topic.</p>
      </div>

      {error && <div className="alert alert-danger">Could not reach the API. Is the backend running on port 4000?</div>}
      {!topics && !error && <Loader label="Loading topics…" />}

      {topics && (
        <div className="row g-4">
          {topics.map((t) => (
            <div className="col-12 col-sm-6 col-lg-3" key={t.id}>
              <TopicCard topic={t} mode="flashcard" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
