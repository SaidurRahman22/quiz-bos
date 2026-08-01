import { useState, useRef, useEffect } from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the user dropdown on outside click.
  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const initials = user?.username?.slice(0, 2).toUpperCase() || '';

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

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
            onClick={toggleTheme}
            title="Toggle theme"
            aria-label="Toggle color theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {user ? (
            <div className="user-menu ms-1" ref={menuRef}>
              <button className="avatar-btn" onClick={() => setMenuOpen((o) => !o)} title={user.username}>
                {initials}
              </button>
              {menuOpen && (
                <div className="user-dropdown fade-in">
                  <div className="user-dropdown-head">
                    <div className="fw-semibold">{user.username}</div>
                    <div className="text-muted-2 text-truncate" style={{ fontSize: '0.8rem' }}>
                      {user.email}
                    </div>
                  </div>
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/profile');
                    }}
                  >
                    👤 Profile
                  </button>
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/');
                    }}
                  >
                    📊 My Dashboard
                  </button>
                  <button
                    className="user-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/saved');
                    }}
                  >
                    ⭐ Saved
                  </button>
                  <button className="user-dropdown-item danger" onClick={handleLogout}>
                    ⎋ Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="qb-nav-link d-none d-sm-inline">
                Log in
              </Link>
              <Link to="/register" className="btn btn-gradient btn-sm ms-1">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
