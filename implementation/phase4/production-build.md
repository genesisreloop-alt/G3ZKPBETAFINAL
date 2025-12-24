# PHASE 4B: PRODUCTION BUILD AND MULTI-PLATFORM PACKAGING
## PWA, Desktop (Electron), Mobile (Capacitor)

**Status:** 40% → 100%  
**Timeline:** Days 6-8 (Week 5-6)

---

## OVERVIEW

Create production-ready builds for all platforms:
1. Progressive Web App (PWA) with offline support
2. Desktop apps (Windows, macOS, Linux) via Electron
3. Mobile apps (iOS, Android) via Capacitor

## DEPENDENCIES

```bash
# PWA
npm install --save-dev vite-plugin-pwa workbox-window

# Electron
npm install --save-dev electron electron-builder concurrently wait-on cross-env

# Capacitor
npm install --save @capacitor/core @capacitor/cli
npm install --save @capacitor/ios @capacitor/android
```

## PWA SETUP

### File: `g3tzkp-messenger UI/vite.config.ts` (Update)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
      manifest: {
        name: 'G3ZKP Messenger',
        short_name: 'G3ZKP',
        description: 'Zero-Knowledge Proof Encrypted P2P Messaging',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'icon-72x72.png',
            sizes: '72x72',
            type: 'image/png'
          },
          {
            src: 'icon-96x96.png',
            sizes: '96x96',
            type: 'image/png'
          },
          {
            src: 'icon-128x128.png',
            sizes: '128x128',
            type: 'image/png'
          },
          {
            src: 'icon-144x144.png',
            sizes: '144x144',
            type: 'image/png'
          },
          {
            src: 'icon-152x152.png',
            sizes: '152x152',
            type: 'image/png'
          },
          {
            src: 'icon-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-384x384.png',
            sizes: '384x384',
            type: 'image/png'
          },
          {
            src: 'icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'nominatim-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    target: 'ES2020',
    outDir: 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'three-vendor': ['three', '@react-three/fiber', '@react-three/drei'],
          'crypto-vendor': ['tweetnacl', 'tweetnacl-util'],
          'map-vendor': ['leaflet', 'react-leaflet'],
          'ui-vendor': ['zustand', 'lucide-react']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@contexts': path.resolve(__dirname, './src/contexts'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  }
});
```

### File: `g3tzkp-messenger UI/src/registerServiceWorker.ts`

```typescript
import { registerSW } from 'virtual:pwa-register';

export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('New version available! Reload to update?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
}
```

### Update `main.tsx` to register service worker:

```typescript
import { registerServiceWorker } from './registerServiceWorker';

// After ReactDOM.createRoot
registerServiceWorker();
```

## ELECTRON SETUP

### File: `electron/main.js`

**FULL ELECTRON MAIN PROCESS:**

```javascript
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const path = require('path');
const url = require('url');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../build/icon.png'),
    titleBarStyle: 'hidden',
    frame: true
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, '../dist/index.html'),
        protocol: 'file:',
        slashes: true
      })
    );
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});
```

### File: `electron/preload.js`

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  platform: process.platform,
  isElectron: true
});
```

### File: `electron-builder.json`

```json
{
  "productName": "G3ZKP Messenger",
  "appId": "com.g3zkp.messenger",
  "directories": {
    "output": "release",
    "buildResources": "build"
  },
  "files": [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],
  "extraMetadata": {
    "main": "electron/main.js"
  },
  "win": {
    "target": ["nsis", "portable"],
    "icon": "build/icon.ico",
    "artifactName": "${productName}-${version}-${arch}.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  },
  "mac": {
    "target": ["dmg", "zip"],
    "icon": "build/icon.icns",
    "category": "public.app-category.social-networking",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "dmg": {
    "contents": [
      {
        "x": 130,
        "y": 220
      },
      {
        "x": 410,
        "y": 220,
        "type": "link",
        "path": "/Applications"
      }
    ]
  },
  "linux": {
    "target": ["AppImage", "deb", "rpm"],
    "icon": "build/icons",
    "category": "Network;InstantMessaging",
    "synopsis": "Zero-Knowledge Proof Encrypted P2P Messenger",
    "description": "Secure peer-to-peer messaging with zero-knowledge proofs and end-to-end encryption"
  }
}
```

### File: `package.json` (Update)

Add electron scripts:

```json
{
  "main": "electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "electron:dev": "concurrently \"cross-env NODE_ENV=development vite\" \"wait-on http://localhost:5000 && cross-env NODE_ENV=development electron .\"",
    "electron:build": "npm run build && electron-builder",
    "electron:build:win": "npm run build && electron-builder --win",
    "electron:build:mac": "npm run build && electron-builder --mac",
    "electron:build:linux": "npm run build && electron-builder --linux"
  }
}
```

## CAPACITOR SETUP

### Initialize Capacitor

```bash
npx cap init "G3ZKP Messenger" "com.g3zkp.messenger"
npx cap add ios
npx cap add android
```

### File: `capacitor.config.ts`

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.g3zkp.messenger',
  appName: 'G3ZKP Messenger',
  webDir: 'dist',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#00FFFF'
    }
  },
  server: {
    androidScheme: 'https',
    cleartext: true
  }
};

export default config;
```

### Build for Mobile

```bash
# Build web assets
npm run build

# Copy to native projects
npx cap copy

# Open in native IDEs
npx cap open ios
npx cap open android
```

## BUILD SCRIPTS

### File: `scripts/build-all.sh`

```bash
#!/bin/bash

echo "========================================="
echo "G3ZKP Messenger - Multi-Platform Build"
echo "========================================="

# Build web assets
echo ""
echo "[1/5] Building web application..."
cd "g3tzkp-messenger UI"
npm run build

# Build PWA
echo ""
echo "[2/5] Building PWA..."
# PWA is already built in step 1

# Build Electron apps
echo ""
echo "[3/5] Building Electron apps..."
npm run electron:build

# Build mobile apps
echo ""
echo "[4/5] Preparing mobile apps..."
npx cap copy
npx cap sync

# Generate checksums
echo ""
echo "[5/5] Generating checksums..."
cd ../release
sha256sum * > checksums.txt

echo ""
echo "========================================="
echo "✓ BUILD COMPLETE"
echo "========================================="
echo ""
echo "Output locations:"
echo "  PWA:      g3tzkp-messenger UI/dist/"
echo "  Desktop:  release/"
echo "  Mobile:   ios/ and android/"
echo "  Checksums: release/checksums.txt"
```

### File: `scripts/build-all.ps1` (Windows)

```powershell
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "G3ZKP Messenger - Multi-Platform Build" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# Build web assets
Write-Host ""
Write-Host "[1/5] Building web application..." -ForegroundColor Yellow
Set-Location "g3tzkp-messenger UI"
npm run build

# Build PWA
Write-Host ""
Write-Host "[2/5] Building PWA..." -ForegroundColor Yellow

# Build Electron apps
Write-Host ""
Write-Host "[3/5] Building Electron apps..." -ForegroundColor Yellow
npm run electron:build

# Build mobile apps
Write-Host ""
Write-Host "[4/5] Preparing mobile apps..." -ForegroundColor Yellow
npx cap copy
npx cap sync

# Generate checksums
Write-Host ""
Write-Host "[5/5] Generating checksums..." -ForegroundColor Yellow
Set-Location ../release
Get-ChildItem | Get-FileHash -Algorithm SHA256 | Format-List | Out-File checksums.txt

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "✓ BUILD COMPLETE" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output locations:"
Write-Host "  PWA:      g3tzkp-messenger UI/dist/"
Write-Host "  Desktop:  release/"
Write-Host "  Mobile:   ios/ and android/"
Write-Host "  Checksums: release/checksums.txt"
```

## CODE SIGNING

### File: `.env.production`

```env
# Code signing certificates (DO NOT COMMIT)
CSC_LINK=path/to/certificate.p12
CSC_KEY_PASSWORD=certificate_password

# macOS notarization
APPLE_ID=your-apple-id@email.com
APPLE_ID_PASSWORD=app-specific-password

# Windows signing
WIN_CSC_LINK=path/to/windows-cert.pfx
WIN_CSC_KEY_PASSWORD=windows_cert_password
```

## DISTRIBUTION

### File: `DISTRIBUTION.md`

```markdown
# G3ZKP Messenger Distribution Guide

## Download Locations

### Web (PWA)
- **URL**: https://messenger.g3zkp.com
- **Installation**: Click "Install" in browser

### Windows
- **Installer**: G3ZKP-Messenger-1.0.0-x64.exe
- **Portable**: G3ZKP-Messenger-1.0.0-portable.exe
- **Checksum**: SHA256 in checksums.txt

### macOS
- **DMG**: G3ZKP-Messenger-1.0.0.dmg
- **ZIP**: G3ZKP-Messenger-1.0.0-mac.zip
- **Checksum**: SHA256 in checksums.txt

### Linux
- **AppImage**: G3ZKP-Messenger-1.0.0.AppImage
- **DEB**: g3zkp-messenger_1.0.0_amd64.deb
- **RPM**: g3zkp-messenger-1.0.0.x86_64.rpm
- **Checksum**: SHA256 in checksums.txt

### Mobile
- **iOS**: Available on App Store (pending approval)
- **Android**: Available on Google Play (pending approval)
- **APK**: Direct download from GitHub releases

## Verification

Verify checksums before installation:

```bash
# Windows (PowerShell)
Get-FileHash G3ZKP-Messenger-1.0.0-x64.exe -Algorithm SHA256

# macOS/Linux
sha256sum G3ZKP-Messenger-1.0.0.dmg
```

Compare with checksums.txt

## Installation

### Windows
1. Download installer
2. Verify checksum
3. Run installer
4. Follow wizard

### macOS
1. Download DMG
2. Verify checksum
3. Open DMG
4. Drag to Applications

### Linux (AppImage)
1. Download AppImage
2. Verify checksum
3. Make executable: `chmod +x G3ZKP-Messenger-1.0.0.AppImage`
4. Run: `./G3ZKP-Messenger-1.0.0.AppImage`

### Mobile
1. Download from app store
2. Install normally
```

## SUCCESS CRITERIA

✅ PWA builds successfully  
✅ PWA works offline  
✅ PWA installable on mobile/desktop  
✅ Electron app builds for Windows  
✅ Electron app builds for macOS  
✅ Electron app builds for Linux  
✅ Capacitor iOS project created  
✅ Capacitor Android project created  
✅ Code signing configured  
✅ Checksums generated  
✅ Build scripts automated  
✅ Distribution guide complete

**RESULT: Deployment 40% → 100% Multi-Platform ✓**
