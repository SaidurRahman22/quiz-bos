import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as apiClient from '../api.js';
import { getToken, setToken, clearToken } from '../tokenStore.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); // finished the initial token check

  // On load, validate any stored token by fetching the current user.
  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    apiClient
      .getMe()
      .then((d) => setUser(d.user))
      .catch(() => clearToken())
      .finally(() => setReady(true));
  }, []);

  const persist = (data, remember) => {
    setToken(data.token, remember);
    setUser(data.user);
    return data.user;
  };

  // remember=true -> stays logged in after closing the browser; false -> only this session.
  const login = useCallback(
    (identifier, password, remember = true) =>
      apiClient.login({ identifier, password }).then((d) => persist(d, remember)),
    []
  );
  const register = useCallback(
    (payload) => apiClient.register(payload).then((d) => persist(d, true)),
    []
  );
  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
