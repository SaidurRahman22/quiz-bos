import { useNavigate } from 'react-router-dom';

// mode: 'quiz' | 'flashcard'
export default function TopicCard({ topic, mode }) {
  const navigate = useNavigate();
  const count = mode === 'quiz' ? topic.quizCount : topic.flashcardCount;
  const unit = mode === 'quiz' ? 'questions' : 'cards';
  const cta = mode === 'quiz' ? 'Start quiz' : 'Study deck';
  const target = mode === 'quiz' ? `/quizzes/${topic.slug}` : `/flashcards/${topic.slug}`;

  return (
    <div className="qb-card topic-card p-4 fade-in" onClick={() => navigate(target)}>
      <div className="accent-bar" style={{ background: topic.color }} />
      <div
        className="topic-icon"
        style={{ background: `color-mix(in srgb, ${topic.color} 16%, transparent)` }}
      >
        {topic.icon}
      </div>
      <h4 className="mb-1">{topic.name}</h4>
      <p className="text-muted-2 mb-3" style={{ fontSize: '0.92rem' }}>
        {topic.description}
      </p>
      <div className="d-flex align-items-center justify-content-between mt-auto">
        <span className="pill">
          {count} {unit}
        </span>
        <span className="fw-semibold" style={{ color: topic.color }}>
          {cta} →
        </span>
      </div>
    </div>
  );
}
