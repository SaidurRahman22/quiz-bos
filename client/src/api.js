import axios from 'axios';
import { getToken } from './tokenStore.js';

// Local dev: leave VITE_API_URL unset -> "/api" is proxied to the Express
// server by Vite (see vite.config.js).
// Production (Vercel): set VITE_API_URL to your deployed backend, e.g.
//   https://your-app.up.railway.app/api
const baseURL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL });

// Attach the JWT (if present) to every request.
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Content
export const getTopics = () => api.get('/topics').then((r) => r.data);
export const getQuiz = (slug) => api.get(`/quizzes/${slug}`).then((r) => r.data);
export const getFlashcards = (slug) => api.get(`/flashcards/${slug}`).then((r) => r.data);
export const getHealth = () => api.get('/health').then((r) => r.data);
export const reportQuestion = (data) => api.post('/reports', data).then((r) => r.data);

// Auth
export const register = (data) => api.post('/auth/register', data).then((r) => r.data);
export const login = (data) => api.post('/auth/login', data).then((r) => r.data);
export const getMe = () => api.get('/auth/me').then((r) => r.data);
export const logoutAll = () => api.post('/auth/logout-all').then((r) => r.data);

// Stats / attempts
export const recordAttempt = (data) => api.post('/attempts', data).then((r) => r.data);
export const getStats = () => api.get('/stats').then((r) => r.data);

export default api;
