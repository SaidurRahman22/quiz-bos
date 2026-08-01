import { useEffect, useRef, useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getStats } from '../api.js';
import Loader from '../components/Loader.jsx';
import './Profile.css';

const MAX_BYTES = 1024 * 1024; // ~1 MB

// Pull a human-readable message out of an axios error, with a fallback.
function errMsg(err, fallback) {
  return err?.response?.data?.error || fallback;
}

// created_at may be undefined or unparseable — always guard.
function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

// First 1–2 initials from a username for the fallback avatar.
function initialsOf(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function Profile() {
  const { user, ready, updateProfile, changePassword, logoutEverywhere } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // ---- Avatar section ----
  const [draftAvatar, setDraftAvatar] = useState(null);
  const [urlInput, setUrlInput] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const [avatarSuccess, setAvatarSuccess] = useState(null);

  // ---- Username section ----
  const [username, setUsername] = useState('');
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState(null);
  const [nameSuccess, setNameSuccess] = useState(null);

  // ---- Password section ----
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState(null);
  const [pwSuccess, setPwSuccess] = useState(null);

  // ---- Stats snapshot ----
  const [stats, setStats] = useState(null);
  const [statsError, setStatsError] = useState(false);

  // ---- Log out everywhere ----
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  // Seed editable fields once the user is available.
  useEffect(() => {
    if (user) {
      setDraftAvatar(user.avatar ?? null);
      setUsername(user.username ?? '');
    }
  }, [user]);

  // Fetch the compact stats snapshot on mount.
  useEffect(() => {
    let alive = true;
    getStats()
      .then((s) => alive && setStats(s))
      .catch(() => alive && setStatsError(true));
    return () => {
      alive = false;
    };
  }, []);

  if (!ready) return <Loader label="Loading your profile…" />;
  if (!user) return <Navigate to="/login" replace />;

  const initials = initialsOf(user.username);
  const memberSince = formatDate(user.created_at);
  const previewSrc = draftAvatar || null;
  const avatarDirty = (draftAvatar || null) !== (user.avatar || null);
  const nameDirty = username.trim() !== '' && username.trim() !== user.username;

  // --- Avatar handlers ---
  const handleFile = (e) => {
    setAvatarError(null);
    setAvatarSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setAvatarError('Image must be under 1 MB — try a smaller GIF/sticker.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraftAvatar(typeof reader.result === 'string' ? reader.result : null);
      setUrlInput('');
    };
    reader.onerror = () => setAvatarError('Could not read that image. Try another file.');
    reader.readAsDataURL(file);
    e.target.value = ''; // allow re-selecting the same file
  };

  const applyUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    setAvatarError(null);
    setAvatarSuccess(null);
    setDraftAvatar(url);
  };

  const removePhoto = () => {
    setAvatarError(null);
    setAvatarSuccess(null);
    setUrlInput('');
    setDraftAvatar(null);
  };

  const saveAvatar = async () => {
    setAvatarBusy(true);
    setAvatarError(null);
    setAvatarSuccess(null);
    try {
      await updateProfile({ avatar: draftAvatar || null });
      setAvatarSuccess('Photo updated.');
    } catch (err) {
      setAvatarError(errMsg(err, 'Could not save your photo. Please try again.'));
    } finally {
      setAvatarBusy(false);
    }
  };

  // --- Username handler ---
  const saveUsername = async (e) => {
    e.preventDefault();
    const next = username.trim();
    if (!next) {
      setNameError('Username cannot be empty.');
      return;
    }
    setNameBusy(true);
    setNameError(null);
    setNameSuccess(null);
    try {
      await updateProfile({ username: next });
      setNameSuccess('Username updated.');
    } catch (err) {
      setNameError(errMsg(err, 'Could not update your username.'));
    } finally {
      setNameBusy(false);
    }
  };

  // --- Password handler ---
  const savePassword = async (e) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);
    if (pwNew.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (pwNew !== pwConfirm) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      await changePassword({ currentPassword: pwCurrent, newPassword: pwNew });
      setPwSuccess('Password updated — other devices have been signed out.');
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
    } catch (err) {
      setPwError(errMsg(err, 'Could not change your password.'));
    } finally {
      setPwBusy(false);
    }
  };

  // --- Log out everywhere ---
  const handleLogoutEverywhere = async () => {
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      await logoutEverywhere();
      navigate('/login');
    } catch {
      setLogoutError('Could not log out everywhere. Please try again.');
      setLogoutBusy(false);
    }
  };

  const summary = stats?.summary;
  const hasStats = !!summary && summary.attempts > 0;
  const avgAccuracy = summary && summary.answered
    ? Math.round((summary.correct / summary.answered) * 100)
    : 0;

  return (
    <div className="container-narrow mx-auto pf-page">
      {/* ===== Hero header ===== */}
      <header className="pf-hero pf-rise" style={{ '--i': 0 }}>
        <div className="pf-hero-orbs" aria-hidden="true">
          <span className="pf-orb pf-orb-1" />
          <span className="pf-orb pf-orb-2" />
        </div>
        <div className="pf-hero-inner">
          <div className="pf-hero-avatar">
            {previewSrc ? (
              <img src={previewSrc} alt={`${user.username}'s avatar`} className="pf-avatar-img" />
            ) : (
              <span className="pf-avatar-initials">{initials}</span>
            )}
          </div>
          <div className="pf-hero-meta">
            <h1 className="pf-hero-name">
              {user.username}
              {user.isAdmin && <span className="pf-badge">Admin</span>}
            </h1>
            {memberSince && <p className="pf-hero-sub">Member since {memberSince}</p>}
            <p className="pf-hero-email">{user.email}</p>
          </div>
        </div>
      </header>

      {/* ===== Stats snapshot ===== */}
      <section className="pf-card pf-rise" style={{ '--i': 1 }}>
        <div className="pf-card-head">
          <h2 className="pf-card-title">Your snapshot</h2>
          <Link to="/" className="pf-link">View full dashboard →</Link>
        </div>
        {statsError ? (
          <p className="pf-muted pf-mb-0">Stats are unavailable right now.</p>
        ) : !stats ? (
          <p className="pf-muted pf-mb-0">Loading your stats…</p>
        ) : !hasStats ? (
          <p className="pf-muted pf-mb-0">No stats yet — take a quiz to get started.</p>
        ) : (
          <div className="pf-stat-row">
            <div className="stat-tile pf-stat">
              <div className="stat-tile-icon">🎯</div>
              <div className="stat-tile-num">{summary.attempts}</div>
              <div className="stat-tile-label">Quizzes taken</div>
            </div>
            <div className="stat-tile pf-stat">
              <div className="stat-tile-icon">🎓</div>
              <div className="stat-tile-num">{avgAccuracy}%</div>
              <div className="stat-tile-label">Avg. accuracy</div>
            </div>
            <div className="stat-tile pf-stat">
              <div className="stat-tile-icon">🏆</div>
              <div className="stat-tile-num">{summary.bestPct}%</div>
              <div className="stat-tile-label">Best score</div>
            </div>
          </div>
        )}
      </section>

      {/* ===== Avatar editor ===== */}
      <section className="pf-card pf-rise" style={{ '--i': 2 }}>
        <h2 className="pf-card-title">Profile photo</h2>
        <p className="pf-muted">Upload an image or sticker, or paste an image URL. Animated GIFs work too.</p>

        <div className="pf-avatar-editor">
          <div className="pf-avatar-preview">
            {previewSrc ? (
              <img src={previewSrc} alt="Avatar preview" className="pf-avatar-img" />
            ) : (
              <span className="pf-avatar-initials">{initials}</span>
            )}
          </div>

          <div className="pf-avatar-controls">
            <div className="pf-btn-row">
              <button
                type="button"
                className="btn btn-gradient"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
              >
                Change photo
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={removePhoto}
                disabled={avatarBusy || !previewSrc}
              >
                Remove photo
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="pf-hidden-file"
              onChange={handleFile}
            />

            <div className="pf-url-row">
              <input
                type="url"
                className="pf-input"
                placeholder="Or paste an image / sticker URL…"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                disabled={avatarBusy}
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={applyUrl}
                disabled={avatarBusy || !urlInput.trim()}
              >
                Use URL
              </button>
            </div>

            <div className="pf-actions">
              <button
                type="button"
                className="btn btn-gradient"
                onClick={saveAvatar}
                disabled={avatarBusy || !avatarDirty}
              >
                {avatarBusy ? 'Saving…' : 'Save photo'}
              </button>
            </div>

            {avatarError && <div className="pf-alert pf-alert-error">{avatarError}</div>}
            {avatarSuccess && <div className="pf-alert pf-alert-success">{avatarSuccess}</div>}
          </div>
        </div>
      </section>

      {/* ===== Account details ===== */}
      <section className="pf-card pf-rise" style={{ '--i': 3 }}>
        <h2 className="pf-card-title">Account details</h2>

        <form className="pf-field" onSubmit={saveUsername}>
          <label className="pf-label" htmlFor="pf-username">Username</label>
          <div className="pf-inline">
            <input
              id="pf-username"
              type="text"
              className="pf-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={nameBusy}
              autoComplete="username"
            />
            <button type="submit" className="btn btn-gradient" disabled={nameBusy || !nameDirty}>
              {nameBusy ? 'Saving…' : 'Save'}
            </button>
          </div>
          {nameError && <div className="pf-alert pf-alert-error">{nameError}</div>}
          {nameSuccess && <div className="pf-alert pf-alert-success">{nameSuccess}</div>}
        </form>

        <div className="pf-field">
          <label className="pf-label" htmlFor="pf-email">Email</label>
          <input id="pf-email" type="email" className="pf-input" value={user.email} readOnly />
          <p className="pf-hint">Email can't be changed.</p>
        </div>
      </section>

      {/* ===== Change password ===== */}
      <section className="pf-card pf-rise" style={{ '--i': 4 }}>
        <h2 className="pf-card-title">Change password</h2>
        <form className="pf-field" onSubmit={savePassword} autoComplete="off">
          <label className="pf-label" htmlFor="pf-current">Current password</label>
          <input
            id="pf-current"
            type="password"
            className="pf-input"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            disabled={pwBusy}
            autoComplete="current-password"
          />

          <label className="pf-label pf-mt" htmlFor="pf-new">New password</label>
          <input
            id="pf-new"
            type="password"
            className="pf-input"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            disabled={pwBusy}
            autoComplete="new-password"
          />

          <label className="pf-label pf-mt" htmlFor="pf-confirm">Confirm new password</label>
          <input
            id="pf-confirm"
            type="password"
            className="pf-input"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            disabled={pwBusy}
            autoComplete="new-password"
          />

          <p className="pf-hint">Use at least 8 characters.</p>
          {pwError && <div className="pf-alert pf-alert-error">{pwError}</div>}
          {pwSuccess && <div className="pf-alert pf-alert-success">{pwSuccess}</div>}

          <div className="pf-actions">
            <button type="submit" className="btn btn-gradient" disabled={pwBusy}>
              {pwBusy ? 'Updating…' : 'Update password'}
            </button>
          </div>
        </form>
      </section>

      {/* ===== Danger zone ===== */}
      <section className="pf-card pf-danger pf-rise" style={{ '--i': 5 }}>
        <h2 className="pf-card-title">Log out everywhere</h2>
        <p className="pf-muted">
          Sign out of this account on every device and browser. You'll need to log in again.
        </p>
        {logoutError && <div className="pf-alert pf-alert-error">{logoutError}</div>}
        <div className="pf-actions">
          <button
            type="button"
            className="btn pf-btn-danger"
            onClick={handleLogoutEverywhere}
            disabled={logoutBusy}
          >
            {logoutBusy ? 'Logging out…' : 'Log out everywhere'}
          </button>
        </div>
      </section>
    </div>
  );
}
