# G3TZKP Messenger - Multi-Platform Deployment Guide

**Version:** 1.0.0  
**Date:** December 2025

---

## 📦 Available Platforms

### Desktop
- ✅ **Windows** (x64, ia32) - NSIS Installer, Portable, ZIP
- ✅ **macOS** (Intel x64, Apple Silicon arm64) - DMG, ZIP  
- ✅ **Linux** (x64, arm64) - AppImage, DEB, RPM, Snap, TAR.GZ

### Mobile
- ✅ **Android** - APK, AAB (Google Play)
- ✅ **iOS** - PWA (Progressive Web App)

### Web
- ✅ **PWA** - Progressive Web App for all browsers

---

## 🛠️ Building All Platforms

### Prerequisites
```bash
# Install dependencies
pnpm install

# Install Electron Builder
pnpm add -D electron-builder electron-updater

# Install Android SDK (for Android builds)
# Download from: https://developer.android.com/studio
```

### Build Commands

```bash
# Build all platforms
node build-all-platforms.js

# Build specific platform
node build-all-platforms.js windows
node build-all-platforms.js mac
node build-all-platforms.js linux
node build-all-platforms.js android
node build-all-platforms.js web
```

### Individual Platform Commands

```bash
# Windows
pnpm run build:win

# macOS (requires macOS)
pnpm run build:mac

# Linux
pnpm run build:linux

# Android
cd android && ./gradlew assembleRelease

# Web/PWA
cd "g3tzkp-messenger UI" && pnpm run build
```

---

## 📥 Distribution Files

### Windows
- **NSIS Installer:** `G3TZKP-Messenger-1.0.0-Setup.exe` (~120 MB)
- **Portable:** `G3TZKP-Messenger-1.0.0-Portable.exe` (~120 MB)
- **ZIP Archive:** `G3TZKP-Messenger-1.0.0-win.zip`

### macOS
- **DMG (Intel):** `G3TZKP-Messenger-1.0.0-x64.dmg` (~130 MB)
- **DMG (Apple Silicon):** `G3TZKP-Messenger-1.0.0-arm64.dmg` (~130 MB)
- **Universal ZIP:** `G3TZKP-Messenger-1.0.0-mac.zip`

### Linux
- **AppImage (x64):** `G3TZKP-Messenger-1.0.0-x64.AppImage` (~140 MB)
- **AppImage (arm64):** `G3TZKP-Messenger-1.0.0-arm64.AppImage`
- **Debian (x64):** `G3TZKP-Messenger-1.0.0-amd64.deb`
- **Debian (arm64):** `G3TZKP-Messenger-1.0.0-arm64.deb`
- **RPM (x64):** `G3TZKP-Messenger-1.0.0-x86_64.rpm`
- **RPM (arm64):** `G3TZKP-Messenger-1.0.0-aarch64.rpm`
- **Snap:** `G3TZKP-Messenger-1.0.0-x64.snap`
- **TAR.GZ:** `G3TZKP-Messenger-1.0.0-x64.tar.gz`

### Android
- **APK:** `app-release.apk` (~50 MB)
- **AAB (Play Store):** `app-release.aab` (~30 MB)

### iOS/PWA
- Accessed via browser at `https://g3zkp.com`
- Add to Home Screen for native-like experience

---

## 🔄 Auto-Update System

### How It Works

1. **Check for Updates**: App checks `https://releases.g3zkp.com/latest.yml` on startup
2. **User Notification**: Dialog shows update details with accept/reject option
3. **Download**: User can download update in background
4. **Install**: User approves installation and app restarts

### Update Server Setup

```bash
# Create releases directory
mkdir -p releases

# Upload builds to releases server
scp release/1.0.0/* user@releases.g3zkp.com:/var/www/releases/

# Electron-builder automatically generates:
# - latest.yml (Windows)
# - latest-mac.yml (macOS)
# - latest-linux.yml (Linux)
```

### Update Configuration

```typescript
// electron/main.ts
autoUpdater.autoDownload = false; // User must approve
autoUpdater.autoInstallOnAppQuit = false; // User controls install
```

### User Experience

```
┌─────────────────────────────────┐
│   📥 Update Available           │
├─────────────────────────────────┤
│   Version: 1.1.0                │
│   Size: 120 MB                  │
│   Released: Dec 21, 2025        │
│                                 │
│   Release Notes:                │
│   - New location sharing        │
│   - Bug fixes                   │
│                                 │
│   [Skip]  [Download Update]    │
└─────────────────────────────────┘
```

---

## 💬 Feedback System

### Collection Methods

**1. In-App Feedback Dialog**
- Accessible from Settings → Send Feedback
- Categories: Bug Report, Feature Request, Improvement, Other
- Optional email for follow-up
- Automatic system info collection

**2. Feedback API Endpoint**
```typescript
POST /api/feedback
{
  "type": "bug" | "feature" | "improvement" | "other",
  "title": "Brief summary",
  "description": "Detailed description",
  "rating": 1-5,
  "email": "optional@email.com",
  "systemInfo": { /* auto-collected */ }
}
```

### Feedback Storage

**Electron (Desktop):**
- Stored locally: `%APPDATA%/G3TZKP Messenger/feedback/`
- Auto-synced to server when online

**Web/Mobile:**
- Direct POST to `https://feedback.g3zkp.com/api/submit`

### Feedback Dashboard

Access at `https://feedback.g3zkp.com/dashboard`

Features:
- View all feedback submissions
- Filter by type, rating, date
- Search feedback
- Export to CSV/JSON
- Reply to users (if email provided)

---

## 🌐 IPFS Distribution

### Setup IPFS Node

```bash
# Install IPFS
npm install -g ipfs

# Initialize
ipfs init

# Start daemon
ipfs daemon
```

### Upload Releases to IPFS

```bash
# Add release directory
ipfs add -r release/1.0.0/

# Pin to ensure availability
ipfs pin add <HASH>

# Generate download links
echo "IPFS: ipfs://<HASH>/G3TZKP-Messenger-1.0.0-Setup.exe"
echo "Gateway: https://ipfs.io/ipfs/<HASH>/G3TZKP-Messenger-1.0.0-Setup.exe"
echo "Magnet: magnet:?xt=urn:btih:<HASH>&dn=G3TZKP-Messenger"
```

### Distribution Links Format

```markdown
## Download G3TZKP Messenger v1.0.0

### Windows
- **Direct**: [Setup.exe](https://releases.g3zkp.com/1.0.0/G3TZKP-Messenger-1.0.0-Setup.exe)
- **IPFS**: [ipfs://QmXxx.../Setup.exe](ipfs://QmXxx.../G3TZKP-Messenger-1.0.0-Setup.exe)
- **Gateway**: [IPFS Gateway](https://ipfs.io/ipfs/QmXxx.../Setup.exe)
- **Magnet**: `magnet:?xt=urn:btih:XXX&dn=G3TZKP-Messenger-Win-1.0.0`

### macOS
- **Direct**: [DMG (Intel)](https://releases.g3zkp.com/1.0.0/G3TZKP-Messenger-1.0.0-x64.dmg)
- **Direct**: [DMG (Apple Silicon)](https://releases.g3zkp.com/1.0.0/G3TZKP-Messenger-1.0.0-arm64.dmg)
- **IPFS**: [ipfs://QmYyy.../dmg](ipfs://QmYyy.../G3TZKP-Messenger-1.0.0-x64.dmg)

### Linux
- **AppImage (x64)**: [Download](https://releases.g3zkp.com/1.0.0/G3TZKP-Messenger-1.0.0-x64.AppImage)
- **Debian**: [Download DEB](https://releases.g3zkp.com/1.0.0/G3TZKP-Messenger-1.0.0-amd64.deb)
- **IPFS**: [ipfs://QmZzz...](ipfs://QmZzz.../G3TZKP-Messenger-1.0.0-x64.AppImage)

### Android
- **APK**: [Download](https://releases.g3zkp.com/1.0.0/app-release.apk)
- **Google Play**: [Install](https://play.google.com/store/apps/details?id=com.g3zkp.messenger)

### iOS/PWA
- **Web App**: [https://g3zkp.com](https://g3zkp.com)
- Add to Home Screen for app experience
```

---

## 📱 Platform-Specific Instructions

### Windows Installation
1. Download `G3TZKP-Messenger-1.0.0-Setup.exe`
2. Run installer (may require admin)
3. Follow installation wizard
4. Launch from Start Menu

### macOS Installation
1. Download DMG for your architecture
2. Open DMG file
3. Drag app to Applications folder
4. Right-click → Open (first time only for Gatekeeper)

### Linux Installation

**AppImage:**
```bash
chmod +x G3TZKP-Messenger-1.0.0-x64.AppImage
./G3TZKP-Messenger-1.0.0-x64.AppImage
```

**Debian/Ubuntu:**
```bash
sudo dpkg -i G3TZKP-Messenger-1.0.0-amd64.deb
sudo apt-get install -f
```

**Fedora/RHEL:**
```bash
sudo rpm -i G3TZKP-Messenger-1.0.0-x86_64.rpm
```

**Snap:**
```bash
sudo snap install G3TZKP-Messenger-1.0.0-x64.snap --dangerous
```

### Android Installation
1. Enable "Install from Unknown Sources"
2. Download APK
3. Open APK file
4. Grant permissions
5. Install

### iOS (PWA)
1. Open Safari and visit `https://g3zkp.com`
2. Tap Share button
3. Select "Add to Home Screen"
4. Confirm

---

## ✅ Deployment Checklist

- [ ] Build all platform packages
- [ ] Test each package on target platform
- [ ] Upload to releases server
- [ ] Upload to IPFS and pin
- [ ] Generate magnet links
- [ ] Update website download links
- [ ] Test auto-update system
- [ ] Configure feedback endpoint
- [ ] Monitor feedback dashboard
- [ ] Announce release

---

## 🔐 Security Notes

- All releases signed with GPG key
- SHA256 checksums provided
- Auto-update uses HTTPS only
- Code signing certificates for Windows/macOS
- Android APK signed with keystore

---

**Questions? feedback@g3zkp.com**
