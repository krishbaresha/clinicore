import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.dirname(__filename);
const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, 'package.json'), 'utf-8'));
const SEMVER = pkg.version || '2.5.0';
const BUILD_DATE = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const BUILD_HASH = '7113922';
const FULL_BUILD_ID = `${BUILD_DATE}.${BUILD_HASH}`;
const FULL_VERSION = `v${SEMVER}+build.${FULL_BUILD_ID}`;
const BUILD_TIME = new Date().toISOString();

function pwaVersionPlugin() {
  return {
    name: 'pwa-version-generator',
    define: {
      __APP_SEMVER__: JSON.stringify(SEMVER),
      __APP_BUILD_HASH__: JSON.stringify(BUILD_HASH),
      __APP_BUILD_DATE__: JSON.stringify(BUILD_DATE),
      __APP_BUILD_ID__: JSON.stringify(FULL_BUILD_ID),
      __APP_FULL_VERSION__: JSON.stringify(FULL_VERSION),
      __APP_BUILD_VERSION__: JSON.stringify(FULL_VERSION),
      __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
      __TARGET_SCHEMA_VERSION__: JSON.stringify(4),
      __MIN_SERVER_SCHEMA_VERSION__: JSON.stringify(3),
    },
    closeBundle() {
      const distDir = path.resolve(rootDir, 'dist')
      if (fs.existsSync(distDir)) {
        // 1. Generate dist/version.json
        const versionData = {
          version: SEMVER,
          full_version: FULL_VERSION,
          build_id: FULL_BUILD_ID,
          git_hash: BUILD_HASH,
          builtAt: BUILD_TIME,
          schema_version: 4,
          min_server_schema: 3,
          app: 'CliniCore / ClinicFlow',
        }
        fs.writeFileSync(
          path.join(distDir, 'version.json'),
          JSON.stringify(versionData, null, 2),
          'utf-8'
        )

        // 2. Inject version into dist/sw.js
        const swDistPath = path.join(distDir, 'sw.js')
        if (fs.existsSync(swDistPath)) {
          let swContent = fs.readFileSync(swDistPath, 'utf-8')
          swContent = swContent.replace(/__SW_CACHE_VERSION__/g, FULL_VERSION)
          swContent = swContent.replace(/__SW_BUILD_TIME__/g, BUILD_TIME)
          fs.writeFileSync(swDistPath, swContent, 'utf-8')
          console.log(`[PWA Plugin] Injected ${FULL_VERSION} into dist/sw.js and dist/version.json`)
        }
      }
    }
  }
}

function viteEmailRelayPlugin() {
  return {
    name: 'vite-email-relay-plugin',
    configureServer(server) {
      server.middlewares.use('/api/v1/system/send-email', (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              const key = (payload.api_key || process.env.RESEND_API_KEY || '').trim();
              const fromAddr = payload.from || 'CliniCore System <backup@clinicore.me>';
              const toAddrs = Array.isArray(payload.to) ? payload.to : [payload.to || 'drasifhosting@gmail.com'];
              const emailSubject = payload.subject || '🏥 CliniCore System Audit & Encrypted Vault Backup';
              const emailHtml = payload.html || '<p>CliniCore System Message</p>';
              const emailAttachments = payload.attachments || [];

              const https = await import('node:https');
              const postData = JSON.stringify({
                from: fromAddr,
                to: toAddrs,
                subject: emailSubject,
                html: emailHtml,
                attachments: emailAttachments,
              });

              const r = https.request('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${key}`,
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(postData),
                },
              }, resendRes => {
                let data = '';
                resendRes.on('data', c => { data += c; });
                resendRes.on('end', () => {
                  res.writeHead(resendRes.statusCode || 200, { 'Content-Type': 'application/json' });
                  try {
                    const parsed = JSON.parse(data || '{}');
                    if (resendRes.statusCode >= 200 && resendRes.statusCode < 300) {
                      res.end(JSON.stringify({ success: true, id: parsed.id || 'resend_sent' }));
                    } else {
                      res.end(JSON.stringify({ success: false, error: parsed.message || parsed.name || 'Resend API call failed', details: parsed }));
                    }
                  } catch {
                    res.end(data);
                  }
                });
              });

              r.on('error', err => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
              });

              r.write(postData);
              r.end();
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err.message }));
            }
          });
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Email Relay Active' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: '/',
  plugins: [
    tailwindcss(),
    react(),
    pwaVersionPlugin(),
    viteEmailRelayPlugin(),
  ],
  build: {
    sourcemap: false,
  },
  server: {
    host: true,
    watch: {
      ignored: ['**/src-tauri/**', '**/target/**', '**/.git/**'],
    },
    proxy: {
      '/api/v1/system/send-email': {
        bypass: () => false,
      },
      '/api': {
        target: 'https://api.clinicore.me',
        changeOrigin: true,
        secure: false,
      }
    }
  }
}))


