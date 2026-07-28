import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FloatingField from '../components/FloatingField.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    if (!identifier.trim() || !password) {
      setError('Enter your username/email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(identifier.trim(), password, remember);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Could not log in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to track your quiz performance."
      footer={
        <>
          New to Quiz Boss? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        {error && <div className="auth-error shake">{error}</div>}
        <FloatingField
          id="identifier"
          label="Username or email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
        />
        <FloatingField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <label className="remember-row">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Remember me on this device</span>
        </label>

        <button className="btn btn-gradient w-100 auth-submit" disabled={loading}>
          {loading ? <span className="btn-spinner" /> : 'Log in →'}
        </button>
      </form>
    </AuthLayout>
  );
}
