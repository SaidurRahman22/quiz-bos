import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as apiClient from '../api.js';
import { getToken, setToken, clearToken, refreshToken } from '../tokenStore.js';

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
  // logout-all bumps the server token_version, invalidating this token too,
  // so on success we clear the local session just like logout.
  const logoutEverywhere = useCallback(
    () =>
      apiClient.logoutAll().then(() => {
        clearToken();
        setUser(null);
      }),
    []
  );

  // Update editable profile fields (username / avatar); reflect the result in context
  // so the navbar avatar and everything else updates immediately.
  const updateProfile = useCallback(
    (patch) => apiClient.updateProfile(patch).then((d) => {
      setUser(d.user);
      return d.user;
    }),
    []
  );

  // Change password with the current password. The server revokes other sessions and
  // returns a fresh token for this one, which we swap in without logging the user out.
  const changePassword = useCallback(
    (payload) => apiClient.changePassword(payload).then((d) => {
      if (d.token) refreshToken(d.token);
      return d;
    }),
    []
  );

  return (
    <AuthContext.Provider
      value={{ user, ready, login, register, logout, logoutEverywhere, updateProfile, changePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}
