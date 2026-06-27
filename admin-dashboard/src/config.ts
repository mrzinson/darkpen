// ─── Backend URL Smart Selection ──────────────────────────────────────────────
// Uses local backend when running locally (faster), falls back to Render when not available.
const LOCAL_API = 'http://localhost:5000/api';
const RENDER_API = 'https://darkpen-backend.onrender.com/api';

// Check if running in a local dev environment (localhost, 127.0.0.1, or [::1])
const isLocal = typeof window !== 'undefined' && 
  (window.location?.hostname === 'localhost' || 
   window.location?.hostname === '127.0.0.1' || 
   window.location?.hostname === '[::1]');

// Override via environment variable if set (e.g. in Vite .env files)
export const API_URL = import.meta.env.VITE_API_URL || (isLocal ? LOCAL_API : RENDER_API);
