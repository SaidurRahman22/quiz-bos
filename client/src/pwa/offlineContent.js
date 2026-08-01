// "Full offline" support: proactively fetch every topic's quiz + flashcard deck so the
// service worker's NetworkFirst cache (see vite.config.js runtimeCaching) holds all
// content. After this runs online, the whole app works with no signal.
import { getTopics, getQuiz, getFlashcards } from '../api.js';

const STATUS_KEY = 'qb-offline-downloaded';

export function getOfflineStatus() {
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY)) || null;
  } catch {
    return null;
  }
}

function setOfflineStatus(status) {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  } catch {
    /* ignore */
  }
}

// Download all content for offline use. `onProgress(pct, done, total)` is called as it goes.
// Returns { topics, at } on success. Failures on individual decks are swallowed so one
// bad topic doesn't abort the whole download.
export async function downloadAllForOffline(onProgress) {
  const topics = await getTopics(); // also caches /api/topics
  const slugs = topics.map((t) => t.slug);
  const total = Math.max(slugs.length * 2, 1); // quiz + flashcards per topic
  let done = 0;
  const tick = () => {
    done += 1;
    if (onProgress) onProgress(Math.round((done / total) * 100), done, total);
  };

  for (const slug of slugs) {
    try {
      await getQuiz(slug);
    } catch {
      /* skip — deck stays uncached */
    } finally {
      tick();
    }
    try {
      await getFlashcards(slug);
    } catch {
      /* skip */
    } finally {
      tick();
    }
  }

  const status = { topics: slugs.length, at: new Date().toISOString() };
  setOfflineStatus(status);
  return status;
}

// Best-effort: drop the cached API content and the recorded status.
export async function clearOfflineContent() {
  try {
    if ('caches' in window) await caches.delete('qb-api-content');
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(STATUS_KEY);
  } catch {
    /* ignore */
  }
}
