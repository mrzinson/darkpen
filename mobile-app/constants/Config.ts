import { Platform } from 'react-native';

const LOCAL_BACKEND_URL = Platform.OS === 'web' ? 'http://localhost:5000' : 'http://192.168.34.5:5000';
const isLocalWeb =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location?.hostname === 'localhost';

const Config = {
  // Point always to the Render production backend where Hostinger database is connected
  API_URL: 'https://darkpen-backend.onrender.com',
  // Always use production URL for things that need public access (e.g. Google Docs Viewer for PDFs)
  PRODUCTION_URL: 'https://darkpen-backend.onrender.com',
  getMediaUrl: (path: string | null | undefined): string | null => {
    if (!path) return null;
    if (path.startsWith('http') || path.startsWith('data:image')) {
      return path;
    }
    const baseUrl = 'https://darkpen-backend.onrender.com';
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${baseUrl}${cleanPath}`;
  }
};

export default Config;
