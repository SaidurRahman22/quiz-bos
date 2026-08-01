import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
  getReminderSettings,
  saveReminderSettings,
  showReminderNow,
  enableBackgroundReminder,
  disableBackgroundReminder,
  startForegroundReminder,
  stopForegroundReminder,
} from '../pwa/notifications.js';
import { downloadAllForOffline, getOfflineStatus, clearOfflineContent } from '../pwa/offlineContent.js';

function formatWhen(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
}

export default function Settings() {
  // ---- Reminders ----
  const supported = notificationsSupported();
  const [reminder, setReminder] = useState(getReminderSettings());
  const [permission, setPermission] = useState(supported ? notificationPermission() : 'denied');
  const [reminderMsg, setReminderMsg] = useState('');

  // ---- Offline ----
  const [offline, setOffline] = useState(getOfflineStatus());
  const [dl, setDl] = useState({ busy: false, pct: 0, error: '' });

  useEffect(() => {
    // Keep the foreground scheduler in sync with the current setting while this page is open.
    if (reminder.enabled && permission === 'granted') startForegroundReminder();
  }, [reminder.enabled, permission]);

  const toggleReminder = async (e) => {
    const enabled = e.target.checked;
    setReminderMsg('');
    if (enabled) {
      const perm = permission === 'granted' ? 'granted' : await requestNotificationPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        setReminderMsg('Notifications are blocked. Allow them in your browser settings to get reminders.');
        return;
      }
      const next = { ...reminder, enabled: true };
      setReminder(next);
      saveReminderSettings(next);
      startForegroundReminder();
      const bg = await enableBackgroundReminder();
      setReminderMsg(
        bg
          ? 'Reminders on. You’ll get a daily nudge (background delivery works best on the installed app).'
          : 'Reminders on. You’ll be reminded while the app is open; background reminders aren’t supported on this device.'
      );
    } else {
      const next = { ...reminder, enabled: false };
      setReminder(next);
      saveReminderSettings(next);
      stopForegroundReminder();
      disableBackgroundReminder();
      setReminderMsg('Reminders turned off.');
    }
  };

  const changeTime = (e) => {
    const next = { ...reminder, time: e.target.value };
    setReminder(next);
    saveReminderSettings(next);
  };

  const sendTest = async () => {
    setReminderMsg('');
    // Ask for permission on the spot if we don't have it yet (this button works standalone).
    let perm = permission === 'granted' ? 'granted' : await requestNotificationPermission();
    setPermission(perm);
    if (perm !== 'granted') {
      setReminderMsg('Notifications are blocked. Allow them in your browser settings, then try again.');
      return;
    }
    const ok = await showReminderNow('This is how your daily reminder will look. 📚');
    setReminderMsg(
      ok
        ? 'Test sent! If you didn’t see it, your device is hiding it — turn off “Do not disturb” / Focus Assist and allow Chrome notifications in Windows Settings → System → Notifications.'
        : 'Couldn’t show a notification — check that notifications are allowed for this site.'
    );
  };

  // ---- Offline handlers ----
  const download = async () => {
    setDl({ busy: true, pct: 0, error: '' });
    try {
      const status = await downloadAllForOffline((pct) => setDl((d) => ({ ...d, pct })));
      setOffline(status);
      setDl({ busy: false, pct: 100, error: '' });
    } catch {
      setDl({ busy: false, pct: 0, error: 'Download failed. Check your connection and try again.' });
    }
  };

  const clear = async () => {
    await clearOfflineContent();
    setOffline(null);
    setDl({ busy: false, pct: 0, error: '' });
  };

  const lastDownloaded = formatWhen(offline?.at);

  return (
    <div className="container-narrow mx-auto fade-in">
      <h1 className="mb-4">⚙️ Settings</h1>

      {/* ---------- Study reminders ---------- */}
      <div className="qb-card p-4 p-md-5 mb-4">
        <h2 className="h5 mb-1">🔔 Study reminders</h2>
        <p className="text-muted-2 mb-3">A daily “Time to study!” notification to keep your streak going.</p>

        {!supported ? (
          <div className="alert alert-warning mb-0">Notifications aren’t supported in this browser.</div>
        ) : (
          <>
            <label className="d-flex align-items-center gap-2 mb-3" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={reminder.enabled} onChange={toggleReminder} />
              <span>Enable daily reminder</span>
            </label>

            <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
              <label htmlFor="reminder-time" className="text-muted-2" style={{ fontSize: '0.9rem' }}>
                Preferred time
              </label>
              <input
                id="reminder-time"
                type="time"
                value={reminder.time}
                onChange={changeTime}
                disabled={!reminder.enabled}
                style={{
                  maxWidth: 150,
                  background: 'var(--surface-2)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '0.4rem 0.6rem',
                }}
              />
              <button className="btn btn-sm btn-ghost" onClick={sendTest}>
                Send a test
              </button>
            </div>

            {reminderMsg && <div className="text-muted-2" style={{ fontSize: '0.88rem' }}>{reminderMsg}</div>}
            <p className="text-muted-2 mb-0" style={{ fontSize: '0.82rem' }}>
              Exact-time delivery is only guaranteed while the app is open. For reliable background
              reminders, install the app to your home screen.
            </p>
          </>
        )}
      </div>

      {/* ---------- Offline ---------- */}
      <div className="qb-card p-4 p-md-5">
        <h2 className="h5 mb-1">📥 Offline access</h2>
        <p className="text-muted-2 mb-3">
          Download every quiz and flashcard deck so the whole app works with no internet.
        </p>

        {dl.busy && (
          <div className="qb-progress mb-3">
            <div className="bar" style={{ width: `${dl.pct}%` }} />
          </div>
        )}
        {dl.error && <div className="alert alert-danger">{dl.error}</div>}

        <div className="d-flex gap-2 flex-wrap align-items-center">
          <button className="btn btn-gradient" onClick={download} disabled={dl.busy}>
            {dl.busy ? `Downloading… ${dl.pct}%` : '📥 Download all for offline'}
          </button>
          {offline && (
            <button className="btn btn-ghost btn-sm" onClick={clear} disabled={dl.busy}>
              Clear offline data
            </button>
          )}
        </div>

        {lastDownloaded && (
          <p className="text-muted-2 mt-3 mb-0" style={{ fontSize: '0.85rem' }}>
            ✅ {offline.topics} topic{offline.topics === 1 ? '' : 's'} saved for offline · last updated{' '}
            {lastDownloaded}
          </p>
        )}
        <p className="text-muted-2 mt-2 mb-0" style={{ fontSize: '0.82rem' }}>
          Tip: content you open online is also cached automatically. <Link to="/quizzes">Browse quizzes →</Link>
        </p>
      </div>
    </div>
  );
}
