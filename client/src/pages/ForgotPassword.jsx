import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FloatingField from '../components/FloatingField.jsx';
import { forgotPassword } from '../api.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await forgotPassword({ email: email.trim() });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      footer={<Link to="/login">Back to log in</Link>}
    >
      {sent ? (
        <div aria-live="polite">
          <p>
            If an account exists for <strong>{email.trim()}</strong>, we've sent a reset
            link. Check your inbox (and spam).
          </p>
          <Link to="/login" className="btn btn-gradient w-100 auth-submit">
            Back to log in →
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} noValidate>
          {error && <div className="auth-error shake">{error}</div>}
          <FloatingField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <button className="btn btn-gradient w-100 auth-submit" disabled={loading}>
            {loading ? <span className="btn-spinner" /> : 'Send reset link →'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
