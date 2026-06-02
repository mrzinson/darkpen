import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

const DOWNLOADS_KEY = 'downloaded_documents_list';

export interface DownloadedDoc {
  pdfUrl: string;
  title: string;
  type: 'book' | 'exam';
  localPath: string;
  image?: string;
  category?: string;
  grade?: string;
  year?: string;
  downloadedAt: string;
}

export const getDownloadedDocs = async (): Promise<DownloadedDoc[]> => {
  try {
    const list = await AsyncStorage.getItem(DOWNLOADS_KEY);
    return list ? JSON.parse(list) : [];
  } catch (e) {
    console.error('Error fetching downloaded list:', e);
    return [];
  }
};

export const registerDownload = async (doc: Omit<DownloadedDoc, 'downloadedAt'>) => {
  try {
    const list = await getDownloadedDocs();
    const exists = list.some(item => item.pdfUrl === doc.pdfUrl);
    if (!exists) {
      const newList = [...list, { ...doc, downloadedAt: new Date().toISOString() }];
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(newList));
    }
  } catch (e) {
    console.error('Error registering download:', e);
  }
};

export const removeDownload = async (pdfUrl: string) => {
  try {
    const list = await getDownloadedDocs();
    const item = list.find(item => item.pdfUrl === pdfUrl);
    if (item) {
      // Check if file exists and delete it
      try {
        const fileInfo = await FileSystem.getInfoAsync(item.localPath);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(item.localPath);
        }
      } catch (err) {
        console.warn('Error deleting local file from disk:', err);
      }
      
      const newList = list.filter(item => item.pdfUrl !== pdfUrl);
      await AsyncStorage.setItem(DOWNLOADS_KEY, JSON.stringify(newList));
    }
  } catch (e) {
    console.error('Error removing download:', e);
  }
};

export const isDocDownloaded = async (pdfUrl: string): Promise<boolean> => {
  try {
    const list = await getDownloadedDocs();
    return list.some(item => item.pdfUrl === pdfUrl);
  } catch (e) {
    return false;
  }
};
