import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '../components/AuthLayout.jsx';
import FloatingField from '../components/FloatingField.jsx';
import { resetPassword } from '../api.js';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword({ token, password });
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout
        title="Reset link invalid"
        subtitle="This reset link is invalid or incomplete."
        footer={<Link to="/login">Back to log in</Link>}
      >
        <div aria-live="polite">
          <p>Please request a fresh password reset link to continue.</p>
          <Link to="/forgot-password" className="btn btn-gradient w-100 auth-submit">
            Request a new link →
          </Link>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="Password reset"
        subtitle="Your password has been reset. You can now log in."
        footer={<Link to="/login">Back to log in</Link>}
      >
        <div aria-live="polite">
          <p>
            For your security, you've been signed out everywhere. Log in fresh with your
            new password.
          </p>
          <Link to="/login" className="btn btn-gradient w-100 auth-submit">
            Go to log in →
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you don't use elsewhere."
      footer={<Link to="/login">Back to log in</Link>}
    >
      <form onSubmit={submit} noValidate>
        {error && (
          <div className="auth-error shake">
            {error}
            {' '}
            <Link to="/forgot-password">Request a new link</Link>
          </div>
        )}
        <FloatingField
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <FloatingField
          id="confirm"
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        <button className="btn btn-gradient w-100 auth-submit" disabled={loading}>
          {loading ? <span className="btn-spinner" /> : 'Reset password →'}
        </button>
      </form>
    </AuthLayout>
  );
}
