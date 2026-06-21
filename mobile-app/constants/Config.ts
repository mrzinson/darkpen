import { Platform } from 'react-native';

// ─── Backend URL Smart Selection ──────────────────────────────────────────────
// Tries local backend first. If it's not reachable, falls back to Render.
// Local = faster (no Render cold-start), Render = always available as backup.

const RENDER_BACKEND = 'https://darkpen-backend.onrender.com';
const LOCAL_IP = '192.168.34.5'; // Change to your PC's local IP if needed
const LOCAL_BACKEND = Platform.OS === 'web' ? 'http://localhost:5000' : `http://${LOCAL_IP}:5000`;

// Attempt to detect if local backend is available (called once on app start)
let resolvedBackendUrl: string = RENDER_BACKEND; // default to Render
let backendResolved = false;

export async function resolveBackendUrl(): Promise<string> {
  if (backendResolved) return resolvedBackendUrl;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000); // 2s timeout
    const res = await fetch(`${LOCAL_BACKEND}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok || res.status < 500) {
      resolvedBackendUrl = LOCAL_BACKEND;
      console.log('[Config] Using LOCAL backend:', LOCAL_BACKEND);
    }
  } catch {
    resolvedBackendUrl = RENDER_BACKEND;
    console.log('[Config] Local backend not reachable, using Render:', RENDER_BACKEND);
  }
  backendResolved = true;
  return resolvedBackendUrl;
}

const Config = {
  // Primary backend URL — resolveBackendUrl() sets this dynamically
  get API_URL() { return resolvedBackendUrl; },
  // For public media URLs always use Render (so links work anywhere)
  PRODUCTION_URL: RENDER_BACKEND,
  getMediaUrl: (path: string | null | undefined): string | null => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:image')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${RENDER_BACKEND}${cleanPath}`;
  }
};

export default Config;
