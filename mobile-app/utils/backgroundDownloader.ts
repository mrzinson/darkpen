import * as FileSystem from 'expo-file-system';
import { registerDownload } from './downloadManager';

export interface DownloadProgressInfo {
  pdfUrl: string;
  title: string;
  progress: number; // 0 to 1
  status: 'downloading' | 'completed' | 'failed';
  error?: string;
  localPath?: string;
}

type ProgressListener = (info: DownloadProgressInfo) => void;

class BackgroundDownloader {
  private activeDownloads: Map<string, {
    promise: Promise<string>;
    progress: number;
    title: string;
    type: 'book' | 'exam';
    listeners: Set<ProgressListener>;
  }> = new Map();

  private globalListeners: Set<() => void> = new Set();

  private notifyGlobalListeners() {
    this.globalListeners.forEach(l => l());
  }

  subscribeGlobal(listener: () => void): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  getActiveDownloads() {
    return Array.from(this.activeDownloads.entries()).map(([pdfUrl, item]) => ({
      pdfUrl,
      title: item.title,
      progress: item.progress,
      type: item.type,
      status: 'downloading' as const
    }));
  }

  // Helper to extract a clean filename
  private getCleanFilename(urlStr: string): string {
    let filename = 'document.pdf';
    try {
      if (urlStr.includes('?')) {
        const queryPart = urlStr.split('?')[1];
        const params = queryPart.split('&');
        const keyParam = params.find(p => p.startsWith('key='));
        if (keyParam) {
          const keyVal = decodeURIComponent(keyParam.split('=')[1]);
          filename = keyVal.split('/').pop() || 'document.pdf';
        } else {
          filename = urlStr.split('/').pop()?.split('?')[0] || 'document.pdf';
        }
      } else {
        filename = urlStr.split('/').pop() || 'document.pdf';
      }
    } catch (e) {
      filename = urlStr.split('/').pop()?.split('?')[0] || 'document.pdf';
    }
    // Remove any remaining invalid characters for filesystem safety
    return filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  isDownloading(pdfUrl: string): boolean {
    return this.activeDownloads.has(pdfUrl);
  }

  getProgress(pdfUrl: string): number {
    const download = this.activeDownloads.get(pdfUrl);
    return download ? download.progress : 0;
  }

  subscribe(pdfUrl: string, listener: ProgressListener): () => void {
    const download = this.activeDownloads.get(pdfUrl);
    if (download) {
      download.listeners.add(listener);
      // Immediately notify listener of current state
      listener({
        pdfUrl,
        title: download.title,
        progress: download.progress,
        status: 'downloading'
      });
    }
    return () => {
      const active = this.activeDownloads.get(pdfUrl);
      if (active) {
        active.listeners.delete(listener);
      }
    };
  }

  async startDownload(pdfUrl: string, title: string, type: 'book' | 'exam'): Promise<string> {
    // Check if already downloading
    const existing = this.activeDownloads.get(pdfUrl);
    if (existing) {
      return existing.promise;
    }

    const filename = this.getCleanFilename(pdfUrl);
    const targetPath = `${FileSystem.documentDirectory}${filename}`;
    const listeners = new Set<ProgressListener>();

    const promise = (async () => {
      // 1. Verify if already cached/downloaded on disk
      try {
        const fileInfo = await FileSystem.getInfoAsync(targetPath);
        if (fileInfo.exists) {
          await registerDownload({
            pdfUrl,
            title,
            type,
            localPath: targetPath,
            grade: 'Form 4',
          });
          this.activeDownloads.delete(pdfUrl);
          this.notifyGlobalListeners();
          return targetPath;
        }
      } catch (e) {
        console.warn('Error checking local path info:', e);
      }

      // 2. Start download
      let attempts = 3;
      let lastErr: any = null;

      for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
          console.log(`[DOWNLOAD] Starting download attempt ${attempt}/${attempts} for ${title}...`);
          const result = await FileSystem.downloadAsync(pdfUrl, targetPath);

          if (result && result.status === 200) {
            clearInterval(progressInterval);

            // Register download in AsyncStorage
            await registerDownload({
              pdfUrl,
              title,
              type,
              localPath: targetPath,
              grade: 'Form 4',
            });

            const active = this.activeDownloads.get(pdfUrl);
            if (active) {
              const info: DownloadProgressInfo = {
                pdfUrl,
                title,
                progress: 1,
                status: 'completed',
                localPath: targetPath
              };
              active.listeners.forEach(l => l(info));
            }
            this.activeDownloads.delete(pdfUrl);
            this.notifyGlobalListeners();
            return targetPath;
          } else {
            throw new Error(`Server returned status code ${result?.status || 'unknown'}`);
          }
        } catch (err: any) {
          lastErr = err;
          console.warn(`[DOWNLOAD ERROR] Attempt ${attempt}/${attempts} failed for ${title}: ${err.message}`);

          if (attempt < attempts) {
            // Exponential backoff
            const backoffDelay = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
      }

      // All attempts failed
      clearInterval(progressInterval);
      const active = this.activeDownloads.get(pdfUrl);
      if (active) {
        const info: DownloadProgressInfo = {
          pdfUrl,
          title,
          progress: active.progress,
          status: 'failed',
          error: lastErr?.message || 'Error downloading file after multiple attempts'
        };
        active.listeners.forEach(l => l(info));
      }
      this.activeDownloads.delete(pdfUrl);
      this.notifyGlobalListeners();
      throw lastErr;
    })();

    // Simulated progress updates to provide visual feedback during download
    let progress = 0.05;
    const progressInterval = setInterval(() => {
      const active = this.activeDownloads.get(pdfUrl);
      if (active) {
        if (progress < 0.92) {
          progress += 0.04;
        }
        active.progress = progress;
        const info: DownloadProgressInfo = {
          pdfUrl,
          title,
          progress,
          status: 'downloading'
        };
        active.listeners.forEach(l => l(info));
        this.notifyGlobalListeners();
      }
    }, 250);

    // Register active download IMMEDIATELY, before yielding execution!
    this.activeDownloads.set(pdfUrl, {
      promise,
      progress: 0.05,
      title,
      type,
      listeners
    });
    this.notifyGlobalListeners();

    return promise;
  }
}

export const backgroundDownloader = new BackgroundDownloader();
