import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Home from './pages/Home.jsx';
import QuizTopics from './pages/QuizTopics.jsx';
import QuizPlay from './pages/QuizPlay.jsx';
import FlashcardTopics from './pages/FlashcardTopics.jsx';
import FlashcardDeck from './pages/FlashcardDeck.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import SavedQuestions from './pages/SavedQuestions.jsx';

const AUTH_ROUTES = ['/login', '/register'];

export default function App() {
  const location = useLocation();
  const immersive = AUTH_ROUTES.includes(location.pathname);

  // Auth pages render full-screen without the app chrome.
  if (immersive) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    );
  }

  return (
    <>
      <Navbar />
      <main className="container py-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/quizzes" element={<QuizTopics />} />
          <Route path="/quizzes/:slug" element={<QuizPlay />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/saved" element={<SavedQuestions />} />
          <Route path="/flashcards" element={<FlashcardTopics />} />
          <Route path="/flashcards/:slug" element={<FlashcardDeck />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <footer className="qb-footer">
        <div className="qb-footer-tag">✨ Sharpen your mind, one quiz at a time and learn boldly, quiz fearlessly ✨</div>
        <div className="qb-footer-copy">
          © {new Date().getFullYear()} · All rights reserved by {' '}
          <span className="footer-brand">Quiz Boss</span>
        </div>
      </footer>
    </>
  );
}
