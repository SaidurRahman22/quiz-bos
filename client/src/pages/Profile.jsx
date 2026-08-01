import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';

export default function Profile() {
  const { user, ready, logoutEverywhere } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!ready) return <Loader label="Loading profile…" />;
  if (!user) return <Navigate to="/login" replace />;

  const handleLogoutEverywhere = async () => {
    setBusy(true);
    setError(null);
    try {
      await logoutEverywhere();
      navigate('/login');
    } catch {
      setError('Could not log out everywhere. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="container-narrow mx-auto fade-in">
      <div className="qb-card p-4 p-md-5">
        <h1 className="mb-4">👤 Profile</h1>

        <div className="mb-2">
          <span className="text-muted-2">Username</span>
          <div className="fw-semibold">{user.username}</div>
        </div>
        <div className="mb-2">
          <span className="text-muted-2">Email</span>
          <div className="fw-semibold">{user.email}</div>
        </div>
        <p className="text-muted-2 mt-3 mb-4">More profile settings coming soon.</p>

        <hr className="my-4" />

        <h2 className="h5 mb-2">Log out everywhere</h2>
        <p className="text-muted-2 mb-3">
          Sign out of this account on all devices. You'll need to log in again.
        </p>
        {error && <div className="alert alert-danger">{error}</div>}
        <button className="btn btn-gradient" onClick={handleLogoutEverywhere} disabled={busy}>
          {busy ? 'Logging out…' : '🔒 Log out everywhere'}
        </button>
      </div>
    </div>
  );
}
