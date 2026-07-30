import { useRegisterSW } from 'virtual:pwa-register/react';
import './pwa.css';

// The ONLY PWA-aware React component. Shows a small toast when the app becomes
// available offline, or when a new version is ready. Kept here so the rest of the
// web app (src/pages, src/components) stays completely unaware of the service worker.
export default function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="pwa-toast" role="alert">
      <span>{needRefresh ? 'A new version is available.' : 'Quiz Boss is ready to work offline. ✅'}</span>
      <div className="pwa-toast-actions">
        {needRefresh && (
          <button className="btn btn-sm btn-gradient" onClick={() => updateServiceWorker(true)}>
            Reload
          </button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={close}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
