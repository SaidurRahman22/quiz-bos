import axios from 'axios';

// Local dev: leave VITE_API_URL unset -> "/api" is proxied to the Express
// server by Vite (see vite.config.js).
// Production (Vercel): set VITE_API_URL to your deployed backend, e.g.
//   https://your-app.up.railway.app/api
const baseURL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL });

export const getTopics = () => api.get('/topics').then((r) => r.data);
export const getQuiz = (slug) => api.get(`/quizzes/${slug}`).then((r) => r.data);
export const getFlashcards = (slug) => api.get(`/flashcards/${slug}`).then((r) => r.data);
export const getHealth = () => api.get('/health').then((r) => r.data);

export default api;
