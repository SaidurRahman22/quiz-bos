import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as apiClient from '../api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = 'qb-token';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // finished the initial token check

  // On load, validate any stored token by fetching the current user.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setReady(true);
      return;
    }
    apiClient
      .getMe()
      .then((d) => setUser(d.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setReady(true));
  }, []);

  const persist = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };

  const login = useCallback(
    (identifier, password) => apiClient.login({ identifier, password }).then(persist),
    []
  );
  const register = useCallback((payload) => apiClient.register(payload).then(persist), []);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
