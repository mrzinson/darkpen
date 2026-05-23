import { Platform } from 'react-native';

const LOCAL_BACKEND_URL = Platform.OS === 'web' ? 'http://localhost:5000' : 'http://192.168.34.5:5000';
const isLocalWeb =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location?.hostname === 'localhost';

const Config = {
  // Local browser/Expo development uses the machine backend; production builds use Render.
  API_URL: __DEV__ || isLocalWeb ? LOCAL_BACKEND_URL : 'https://darkpen-backend.onrender.com',
  // Always use production URL for things that need public access (e.g. Google Docs Viewer for PDFs)
  PRODUCTION_URL: 'https://darkpen-backend.onrender.com',
};

export default Config;
