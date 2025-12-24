import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Update system
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  skipUpdate: () => ipcRenderer.invoke('skip-update'),
  onUpdateAvailable: (callback: (info: any) => void) => {
    ipcRenderer.on('update-available', (event, info) => callback(info));
  },
  onUpdateStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('update-status', (event, status) => callback(status));
  },
  onDownloadProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('download-progress', (event, progress) => callback(progress));
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    ipcRenderer.on('update-downloaded', (event, info) => callback(info));
  },
  onUpdateError: (callback: (error: any) => void) => {
    ipcRenderer.on('update-error', (event, error) => callback(error));
  },

  // Feedback system
  submitFeedback: (feedback: any) => ipcRenderer.invoke('submit-feedback', feedback),

  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // File operations
  selectFile: () => ipcRenderer.invoke('select-file'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Platform detection
  platform: process.platform,
  isElectron: true
});

// Types for TypeScript
export interface ElectronAPI {
  checkForUpdates: () => Promise<{ checking: boolean }>;
  downloadUpdate: () => Promise<{ downloading: boolean; error?: string }>;
  installUpdate: () => Promise<{ installing: boolean; error?: string }>;
  skipUpdate: () => Promise<{ skipped: boolean }>;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onUpdateStatus: (callback: (status: any) => void) => void;
  onDownloadProgress: (callback: (progress: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  onUpdateError: (callback: (error: any) => void) => void;
  submitFeedback: (feedback: any) => Promise<{ success: boolean; id?: string; error?: string }>;
  getSystemInfo: () => Promise<any>;
  selectFile: () => Promise<{ path: string | null }>;
  openExternal: (url: string) => Promise<{ opened: boolean }>;
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
