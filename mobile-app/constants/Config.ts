import { Platform } from 'react-native';

const Config = {
  // In development, connect to local backend (using PC IP), in production use Render
  API_URL: __DEV__ ? 'http://192.168.111.5:5000' : 'https://darkpen-backend.onrender.com',
};

export default Config;
