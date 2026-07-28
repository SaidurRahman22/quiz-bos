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
