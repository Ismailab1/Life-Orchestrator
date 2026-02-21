/**
 * DESIGN DECISION: Vite Build Configuration
 * 
 * Vite provides fast development with Hot Module Replacement (HMR) and optimized production builds.
 * 
 * Key Configuration Choices:
 * 
 * 1. **Environment Variable Injection**:
 *    process.env.API_KEY is injected at build time from .env file.
 *    This keeps secrets out of source code while enabling client-side API calls.
 *    Note: Client-side env vars are publicly visible in bundle (safe for API keys
 *    that require origin restrictions, not for secrets).
 * 
 * 2. **CORS Headers for OAuth**:
 *    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
 *    Enables Google OAuth popup flow without blocking cross-origin communication.
 *    Google Identity Services requires this header for security.
 * 
 * 3. **Vendor Code Splitting**:
 *    manualChunks separates node_modules into 'vendor.js'
 *    Benefits:
 *    - Vendor code cached separately (changes less frequently)
 *    - Parallel download of app.js and vendor.js
 *    - Faster rebuilds during development
 * 
 * 4. **Port Configuration**:
 *    Port 3000 on 0.0.0.0 (all network interfaces)
 *    Enables mobile device testing on local network via 192.168.x.x:3000
 * 
 * 5. **Path Aliases**:
 *    '@' resolves to project root for cleaner imports:
 *    import { Task } from '@/types' vs import { Task } from '../../types'
 */

import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
            'Cross-Origin-Embedder-Policy': 'unsafe-none'
        }
      },
      build: {
        outDir: 'dist',
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        return 'vendor';
                    }
                }
            }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
