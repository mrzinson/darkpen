import { Platform } from 'react-native';

const Config = {
  // Adeegso 'localhost' haddii aad web ku jirto si looga fogaado xannibaadaha browser-ka (CORS/HTTPS)
  // Haddiise aad mobile dhab ah isticmaalayso, isticmaal IP-gaaga (10.129.6.225)
  API_URL: Platform.OS === 'web' ? 'http://localhost:5000' : 'http://10.129.6.225:5000',
};

export default Config;
