// Central place for the auth token so "Remember me" can choose where it lives:
//   remember = true  -> localStorage   (survives closing the browser)
//   remember = false -> sessionStorage (cleared when the browser session ends)
const KEY = 'qb-token';

export function getToken() {
  return sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
}

export function setToken(token, remember) {
  if (remember) {
    localStorage.setItem(KEY, token);
    sessionStorage.removeItem(KEY);
  } else {
    sessionStorage.setItem(KEY, token);
    localStorage.removeItem(KEY);
  }
}

export function clearToken() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}

// Replace the token in whichever store currently holds it (preserves the user's
// "remember me" choice). Used after a password change hands back a fresh token.
export function refreshToken(token) {
  if (localStorage.getItem(KEY) != null) localStorage.setItem(KEY, token);
  else sessionStorage.setItem(KEY, token);
}
