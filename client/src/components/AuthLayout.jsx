import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext.jsx';

// Immersive, animated shell shared by the Login and Register pages.
export default function AuthLayout({ title, subtitle, children, footer }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="auth-wrap">
      {/* Animated aurora background */}
      <div className="auth-bg" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
        <span className="auth-grid" />
      </div>

      <button
        className="theme-toggle auth-theme-toggle"
        onClick={toggleTheme}
        aria-label="Toggle color theme"
        title="Toggle theme"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="auth-card fade-up">
        <Link to="/" className="qb-brand auth-brand">
          <span>🧠</span>
          <span>
            Quiz<span className="gradient-text">Boss</span>
          </span>
        </Link>

        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}

        {children}

        {footer && <div className="auth-footer">{footer}</div>}
      </div>
    </div>
  );
}
