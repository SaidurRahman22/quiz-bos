import { NavLink, Link } from 'react-router-dom';

export default function Navbar({ theme, onToggleTheme }) {
  return (
    <nav className="qb-navbar">
      <div className="container d-flex align-items-center justify-content-between py-2">
        <Link to="/" className="qb-brand">
          <span>🧠</span>
          <span>
            Quiz<span className="gradient-text">Boss</span>
          </span>
        </Link>

        <div className="d-flex align-items-center gap-1 gap-sm-2">
          <NavLink to="/" end className="qb-nav-link d-none d-sm-inline">
            Home
          </NavLink>
          <NavLink to="/quizzes" className="qb-nav-link">
            Quizzes
          </NavLink>
          <NavLink to="/flashcards" className="qb-nav-link">
            Flashcards
          </NavLink>
          <button
            className="theme-toggle ms-1"
            onClick={onToggleTheme}
            title="Toggle theme"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </nav>
  );
}
