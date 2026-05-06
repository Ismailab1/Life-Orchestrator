/**
 * Life Orchestrator — Production Server
 *
 * Responsibilities:
 *  1. Proxy /api/gemini/* → https://generativelanguage.googleapis.com/*
 *     The GEMINI_API_KEY is injected here, server-side only. It is never
 *     bundled into the client JavaScript or returned to the browser.
 *
 *  2. Serve the built React SPA from ../dist with proper CORS headers for
 *     Google OAuth popup flow.
 *
 *  3. SPA fallback — unknown routes serve index.html so client-side routing
 *     (react-router-dom) works after a hard reload.
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error('[server] FATAL: GEMINI_API_KEY environment variable is not set. Exiting.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Gemini API proxy
//    Client sends requests to /api/gemini/* with key=server-proxy (a dummy).
//    This proxy strips that dummy key and injects the real one from the env,
//    then forwards to Google's Generative Language API.
// ---------------------------------------------------------------------------
app.use(
  '/api/gemini',
  createProxyMiddleware({
    target: 'https://generativelanguage.googleapis.com',
    changeOrigin: true,
    pathRewrite: { '^/api/gemini': '' },
    // Disable response body buffering so streaming (SSE) works correctly.
    selfHandleResponse: false,
    on: {
      proxyReq: (proxyReq) => {
        // Replace the placeholder key with the real server-side key.
        const [pathname, qs] = proxyReq.path.split('?');
        const params = new URLSearchParams(qs || '');
        params.delete('key');
        params.set('key', GEMINI_API_KEY);
        proxyReq.path = `${pathname}?${params.toString()}`;
      },
      error: (err, _req, res) => {
        console.error('[proxy] Gemini proxy error:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Gemini proxy error', detail: err.message });
        }
      },
    },
  })
);

// ---------------------------------------------------------------------------
// 2. Static file serving
//    Serve the Vite-built frontend with headers required for Google OAuth.
// ---------------------------------------------------------------------------
const distPath = path.join(__dirname, 'dist');

app.use(
  express.static(distPath, {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    },
  })
);

// ---------------------------------------------------------------------------
// 3. SPA fallback
// ---------------------------------------------------------------------------
app.get('*', (_req, res) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[server] Life Orchestrator running on port ${PORT}`);
});
