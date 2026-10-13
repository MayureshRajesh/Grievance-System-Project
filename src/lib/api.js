// Backend base URL. Empty = same origin (Vercel serverless /api, or Vite dev proxy).
// Set VITE_API_URL only if the API is hosted on a different origin.
export const API_URL = import.meta.env.VITE_API_URL ?? '';
