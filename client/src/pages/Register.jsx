import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FloatingField from '../components/FloatingField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { passwordStrength } from '../utils.js';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!USERNAME_RE.test(username.trim())) {
      setError('Username must be 3–30 letters, numbers, or underscores.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await register({ username: username.trim(), email: email.trim(), password });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="No email verification — start learning in seconds."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        {error && <div className="auth-error shake">{error}</div>}
        <FloatingField
          id="username"
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <FloatingField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
        <FloatingField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />

        {password && (
          <div className="pw-meter" aria-live="polite">
            <div className="pw-meter-track">
              <div className={`pw-meter-bar s${strength.score}`} style={{ width: `${strength.pct}%` }} />
            </div>
            <span className={`pw-meter-label s${strength.score}`}>{strength.label}</span>
          </div>
        )}

        <button className="btn btn-gradient w-100 auth-submit" disabled={loading}>
          {loading ? <span className="btn-spinner" /> : 'Create account →'}
        </button>
      </form>
    </AuthLayout>
  );
}
