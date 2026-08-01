/* Custom service-worker logic layered on top of the vite-plugin-pwa (Workbox) service
 * worker via `workbox.importScripts`. Adds study-reminder notifications:
 *   - periodicsync: fires ~daily on supported installed PWAs (browser decides timing).
 *   - push:        supports an optional future Web-Push server payload.
 *   - notificationclick: focuses/opens the app at the quizzes page.
 * All handlers are defensive — they never throw if an API is missing.
 */
/* global self */

const REMINDER_TAG = 'study-reminder';
const ICON = '/pwa/icon-192.png';

function showStudyReminder(title, body) {
  return self.registration.showNotification(title || 'Time to study! 📚', {
    body: body || 'Keep your streak alive — take a quick quiz.',
    icon: ICON,
    badge: ICON,
    tag: REMINDER_TAG,
    renotify: true,
    data: { url: '/quizzes' },
  });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === REMINDER_TAG) {
    event.waitUntil(showStudyReminder());
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  event.waitUntil(showStudyReminder(data.title, data.body));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
      return undefined;
    })
  );
});
