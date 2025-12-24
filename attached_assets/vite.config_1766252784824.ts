import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProduction = mode === 'production';
  const isElectron = process.env.VITE_APP_ELECTRON === 'true';

  return {
    // Base configuration
    base: env.VITE_PUBLIC_URL || '/',
    root: '.',
    
    // Development server
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
    },
    
    // Preview server
    preview: {
      port: 4173,
      host: '0.0.0.0',
      strictPort: true,
    },
    
    // Build configuration
    build: {
      target: 'esnext',
      minify: isProduction ? 'esbuild' : false,
      sourcemap: !isProduction,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            // Vendor chunks
            'react-vendor': ['react', 'react-dom'],
            'router-vendor': ['react-router-dom'],
            'crypto-vendor': ['tweetnacl', 'tweetnacl-util', 'libsodium-wrappers'],
            'libp2p-vendor': ['libp2p', 'peer-id'],
            'zkp-vendor': ['snarkjs', 'circomlib'],
            'ui-vendor': ['lucide-react', '@headlessui/react', 'framer-motion'],
            'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          },
          // Asset naming
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/css/i.test(ext)) {
              return `assets/css/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    
    // Environment variables
    define: {
      // Global process polyfill for Node.js modules in browser
      global: 'globalThis',
      'process.env': '{}',
      // API keys
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_APP_VERSION': JSON.stringify(process.env.npm_package_version),
      'process.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    },
    
    // Module resolution
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@types': path.resolve(__dirname, './src/types'),
        '@store': path.resolve(__dirname, './src/store'),
        '@lib': path.resolve(__dirname, './src/lib'),
        'events': 'eventemitter3',
        'crypto': 'crypto-browserify',
        'stream': 'stream-browserify',
        'buffer': 'buffer',
        'util': 'util',
      },
    },
    
    // Prevent Node.js built-ins from being externalized
    ssr: {
      noExternal: ['events', 'buffer', 'process', 'stream', 'util', 'crypto'],
    },
    
    // CSS configuration
    css: {
      devSourcemap: !isProduction,
      postcss: './postcss.config.cjs',
    },
    
    // Optimization
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'zustand',
        'lucide-react',
        'framer-motion',
        'socket.io-client',
        'tweetnacl',
        'tweetnacl-util',
        'eventemitter3',
        'buffer',
        'process',
        'crypto-browserify',
        'stream-browserify',
        'browser-level',
      ],
      exclude: [
        // Exclude electron modules from browser optimization
        ...(isElectron ? [] : ['electron']),
      ],
      esbuildOptions: {
        define: {
          global: 'globalThis',
        },
      },
    },
    
    // Plugins
    plugins: [
      // React plugin
      react(),
      
      // PWA plugin for web deployment
      !isElectron && VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'G3ZKP Messenger',
          short_name: 'G3ZKP',
          description: 'Secure Zero-Knowledge Messaging Platform',
          theme_color: '#0088FF',
          background_color: '#ffffff',
          display: 'standalone',
          scope: '/',
          start_url: '/',
          orientation: 'portrait-primary',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\./,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 // 24 hours
                }
              }
            },
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif)$/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                }
              }
            }
          ]
        }
      }),
      
      // Electron plugin for desktop
      isElectron && electron([
        {
          entry: 'electron/main.ts',
          onstart(options) {
            options.startup();
          },
          vite: {
            build: {
              sourcemap: true,
              minify: process.env.NODE_ENV === 'production',
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron', 'path', 'fs', 'os'],
              },
            },
          },
        },
        {
          entry: 'electron/preload.ts',
          onstart(options) {
            options.reload();
          },
          vite: {
            build: {
              sourcemap: 'inline',
              minify: process.env.NODE_ENV === 'production',
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron'],
              },
            },
          },
        },
      ]),
      
      // Electron renderer plugin
      isElectron && renderer(),
      
      // Bundle analyzer (only in production)
      isProduction && visualizer({
        filename: 'dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ].filter(Boolean),
    
    // Worker configuration
    worker: {
      format: 'es',
    },
    
    // JSON configuration
    json: {
      stringify: true,
    },
  };
});
