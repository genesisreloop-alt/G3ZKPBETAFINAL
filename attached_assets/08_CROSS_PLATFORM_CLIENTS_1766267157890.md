# G3ZKP Implementation Plan - Part 08
## Cross-Platform Clients

---

## 1. PROGRESSIVE WEB APP (PWA)

### 1.1 Main Application

**File: `clients/pwa/src/App.tsx`**

```typescript
import React, { useEffect, useState } from 'react';
import { G3ZKPApplication } from '@g3zkp/core';
import { ChatView } from './components/ChatView';
import { ContactList } from './components/ContactList';
import { Settings } from './components/Settings';

const g3zkp = new G3ZKPApplication();

export function App() {
  const [initialized, setInitialized] = useState(false);
  const [activeView, setActiveView] = useState<'chat' | 'contacts' | 'settings'>('chat');
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  useEffect(() => {
    g3zkp.initialize().then(() => setInitialized(true));
    return () => { g3zkp.shutdown(); };
  }, []);

  if (!initialized) {
    return <div className="loading">Initializing G3ZKP...</div>;
  }

  return (
    <div className="app">
      <nav className="sidebar">
        <button onClick={() => setActiveView('chat')} className={activeView === 'chat' ? 'active' : ''}>
          Messages
        </button>
        <button onClick={() => setActiveView('contacts')} className={activeView === 'contacts' ? 'active' : ''}>
          Contacts
        </button>
        <button onClick={() => setActiveView('settings')} className={activeView === 'settings' ? 'active' : ''}>
          Settings
        </button>
      </nav>
      <main className="content">
        {activeView === 'chat' && (
          <ChatView
            conversationId={selectedConversation}
            onSelectConversation={setSelectedConversation}
          />
        )}
        {activeView === 'contacts' && <ContactList />}
        {activeView === 'settings' && <Settings />}
      </main>
    </div>
  );
}
```

### 1.2 Service Worker

**File: `clients/pwa/public/sw.js`**

```javascript
const CACHE_NAME = 'g3zkp-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index.js',
  '/assets/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
      return cached || fetched;
    })
  );
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'G3ZKP', body: 'New message' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      tag: data.tag || 'default'
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

### 1.3 PWA Manifest

**File: `clients/pwa/public/manifest.json`**

```json
{
  "name": "G3ZKP Messenger",
  "short_name": "G3ZKP",
  "description": "Zero-Knowledge Encrypted Messaging",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#4a4ae8",
  "icons": [
    { "src": "/icons/icon-72.png", "sizes": "72x72", "type": "image/png" },
    { "src": "/icons/icon-96.png", "sizes": "96x96", "type": "image/png" },
    { "src": "/icons/icon-128.png", "sizes": "128x128", "type": "image/png" },
    { "src": "/icons/icon-144.png", "sizes": "144x144", "type": "image/png" },
    { "src": "/icons/icon-152.png", "sizes": "152x152", "type": "image/png" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-384.png", "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

---

## 2. ANDROID APPLICATION

### 2.1 Main Activity

**File: `clients/android/app/src/main/kotlin/net/g3zkp/messenger/MainActivity.kt`**

```kotlin
package net.g3zkp.messenger

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.lifecycle.viewmodel.compose.viewModel
import net.g3zkp.messenger.ui.theme.G3ZKPTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            G3ZKPTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    G3ZKPApp()
                }
            }
        }
    }
}

@Composable
fun G3ZKPApp(viewModel: MainViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()

    when (uiState) {
        is UiState.Loading -> LoadingScreen()
        is UiState.Ready -> MainScreen(viewModel)
        is UiState.Error -> ErrorScreen((uiState as UiState.Error).message)
    }
}

@Composable
fun MainScreen(viewModel: MainViewModel) {
    var selectedTab by remember { mutableStateOf(0) }
    
    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Chat, "Messages") },
                    label = { Text("Messages") }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Contacts, "Contacts") },
                    label = { Text("Contacts") }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.Settings, "Settings") },
                    label = { Text("Settings") }
                )
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (selectedTab) {
                0 -> MessagesScreen(viewModel)
                1 -> ContactsScreen(viewModel)
                2 -> SettingsScreen(viewModel)
            }
        }
    }
}
```

### 2.2 G3ZKP Engine (Android)

**File: `clients/android/app/src/main/kotlin/net/g3zkp/messenger/G3ZKPEngine.kt`**

```kotlin
package net.g3zkp.messenger

import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*

class G3ZKPEngine {
    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _messages = MutableSharedFlow<Message>()
    val messages: SharedFlow<Message> = _messages.asSharedFlow()

    suspend fun initialize() {
        withContext(Dispatchers.IO) {
            _connectionState.value = ConnectionState.Connecting
            // Initialize crypto, network, storage
            delay(1000) // Simulated init time
            _connectionState.value = ConnectionState.Connected
        }
    }

    suspend fun sendMessage(conversationId: String, content: String): Result<Message> {
        return withContext(Dispatchers.IO) {
            try {
                val message = Message(
                    id = java.util.UUID.randomUUID().toString(),
                    conversationId = conversationId,
                    content = content,
                    timestamp = System.currentTimeMillis(),
                    status = MessageStatus.PENDING
                )
                // Encrypt and send via network
                _messages.emit(message.copy(status = MessageStatus.SENT))
                Result.success(message)
            } catch (e: Exception) {
                Result.failure(e)
            }
        }
    }

    fun shutdown() {
        scope.cancel()
        _connectionState.value = ConnectionState.Disconnected
    }
}

enum class ConnectionState { Disconnected, Connecting, Connected, Error }
enum class MessageStatus { PENDING, SENT, DELIVERED, READ, FAILED }

data class Message(
    val id: String,
    val conversationId: String,
    val content: String,
    val timestamp: Long,
    val status: MessageStatus
)
```

---

## 3. DESKTOP APPLICATION (ELECTRON)

### 3.1 Main Process

**File: `clients/desktop/electron/main.ts`**

```typescript
import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    titleBarStyle: 'hiddenInset',
    show: false
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (process.platform === 'darwin') {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function createTray(): void {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'icons/tray.png'));
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show G3ZKP', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('G3ZKP Messenger');

  tray.on('click', () => mainWindow?.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  autoUpdater.checkForUpdatesAndNotify();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow?.show();
});

// IPC Handlers
ipcMain.handle('get-version', () => app.getVersion());
ipcMain.handle('get-platform', () => process.platform);
```

### 3.2 Preload Script

**File: `clients/desktop/electron/preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('g3zkp', {
  platform: () => ipcRenderer.invoke('get-platform'),
  version: () => ipcRenderer.invoke('get-version'),
  
  onMessage: (callback: (msg: any) => void) => {
    ipcRenderer.on('message', (_, msg) => callback(msg));
  },
  
  sendMessage: (conversationId: string, content: string) => {
    return ipcRenderer.invoke('send-message', { conversationId, content });
  },
  
  showNotification: (title: string, body: string) => {
    return ipcRenderer.invoke('show-notification', { title, body });
  }
});
```

---

## 4. BUILD CONFIGURATIONS

### 4.1 PWA Vite Config

**File: `clients/pwa/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: false, // Use external manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024
      }
    })
  ],
  build: {
    target: 'esnext',
    outDir: 'dist',
    sourcemap: true
  }
});
```

### 4.2 Android Gradle

**File: `clients/android/app/build.gradle.kts`**

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "net.g3zkp.messenger"
    compileSdk = 34

    defaultConfig {
        applicationId = "net.g3zkp.messenger"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
        }
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.0"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.6.2")
    implementation("androidx.activity:activity-compose:1.8.0")
    implementation(platform("androidx.compose:compose-bom:2023.10.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

---

*End of Cross-Platform Clients*
