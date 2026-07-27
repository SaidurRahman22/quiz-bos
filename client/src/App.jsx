import { useEffect, useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import QuizTopics from './pages/QuizTopics.jsx';
import QuizPlay from './pages/QuizPlay.jsx';
import FlashcardTopics from './pages/FlashcardTopics.jsx';
import FlashcardDeck from './pages/FlashcardDeck.jsx';

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('qb-theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('qb-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <>
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <main className="container py-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quizzes" element={<QuizTopics />} />
          <Route path="/quizzes/:slug" element={<QuizPlay />} />
          <Route path="/flashcards" element={<FlashcardTopics />} />
          <Route path="/flashcards/:slug" element={<FlashcardDeck />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <footer className="qb-footer">
        Built with React, Bootstrap & MySQL · <span className="gradient-text fw-semibold">Quiz Boss</span> — no login required
      </footer>
    </>
  );
}
