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
export const updateProfile = (data) => api.patch('/auth/me', data).then((r) => r.data);
export const changePassword = (data) => api.post('/auth/change-password', data).then((r) => r.data);
export const forgotPassword = (data) => api.post('/auth/forgot-password', data).then((r) => r.data);
export const resetPassword = (data) => api.post('/auth/reset-password', data).then((r) => r.data);

// Admin (question CRUD — requires an admin account)
export const adminGetTopics = () => api.get('/admin/topics').then((r) => r.data.topics);
export const adminListQuestions = (topic) =>
  api.get('/admin/questions', { params: { topic } }).then((r) => r.data.questions);
export const adminCreateQuestion = (data) => api.post('/admin/questions', data).then((r) => r.data.question);
export const adminUpdateQuestion = (id, data) =>
  api.put(`/admin/questions/${id}`, data).then((r) => r.data.question);
export const adminDeleteQuestion = (id) => api.delete(`/admin/questions/${id}`).then((r) => r.data);

// Stats / attempts
export const recordAttempt = (data) => api.post('/attempts', data).then((r) => r.data);
export const getStats = () => api.get('/stats').then((r) => r.data);

// Saved questions
export const getSavedQuestions = () => api.get('/saved').then((r) => r.data.saved);
export const saveQuestion = (data) => api.post('/saved', data).then((r) => r.data);
export const unsaveQuestion = (questionId) => api.delete(`/saved/${questionId}`).then((r) => r.data);

export default api;
