/**
 * LLM Proxy Service — proxies chat completion requests to internal-api.z.ai
 * This service runs on the dev machine where the LLM API is accessible.
 * Vercel's serverless functions can't reach internal-api.z.ai (private IPs),
 * so they call this proxy through the Caddy gateway instead.
 *
 * Port: 3030
 * Run from project root: node mini-services/llm-proxy/index.ts
 */

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ──────────────────── Load LLM Config ────────────────────
function loadLLMConfig() {
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(process.cwd(), '..', '..', '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config',
  ];
  for (const filePath of configPaths) {
    try {
      const configStr = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) {
        console.log(`[llm-proxy] Config loaded from ${filePath}`);
        return config;
      }
    } catch {}
  }
  throw new Error('[llm-proxy] LLM config not found');
}

const CONFIG = loadLLMConfig();
const PORT = 3030;

// ──────────────────── HTTP Server ────────────────────
const server = http.createServer((req: any, res: any) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'llm-proxy', baseUrl: CONFIG.baseUrl }));
    return;
  }

  // Proxy chat completion requests
  if (req.method === 'POST' && url.pathname === '/chat/completions') {
    let body = '';
    req.on('data', (chunk: string) => { body += chunk; });
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        const requestBody = { ...parsed, thinking: parsed.thinking || { type: 'disabled' } };

        const apiUrl = `${CONFIG.baseUrl}/chat/completions`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CONFIG.apiKey}`,
          'X-Z-AI-From': 'Z',
        };
        if (CONFIG.chatId) headers['X-Chat-Id'] = CONFIG.chatId;
        if (CONFIG.userId) headers['X-User-Id'] = CONFIG.userId;
        if (CONFIG.token) headers['X-Token'] = CONFIG.token;

        const postData = JSON.stringify(requestBody);
        headers['Content-Length'] = String(Buffer.byteLength(postData));

        console.log(`[llm-proxy] Proxying to ${apiUrl} (${(postData.length / 1024).toFixed(1)}KB)`);

        const urlObj = new URL(apiUrl);
        const mod = urlObj.protocol === 'https:' ? https : http;

        const proxyReq = mod.request(apiUrl, { method: 'POST', headers }, (proxyRes: any) => {
          let data = '';
          proxyRes.on('data', (chunk: string) => { data += chunk; });
          proxyRes.on('end', () => {
            console.log(`[llm-proxy] Response: ${proxyRes.statusCode} (${(data.length / 1024).toFixed(1)}KB)`);
            res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
            res.end(data);
          });
        });

        proxyReq.on('error', (err: Error) => {
          console.error(`[llm-proxy] Proxy error: ${err.message}`);
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });

        proxyReq.write(postData);
        proxyReq.end();
      } catch (err: any) {
        console.error(`[llm-proxy] Handler error: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

process.on('uncaughtException', (err: Error) => {
  console.error(`[llm-proxy] UNCAUGHT: ${err.message}`);
});

server.listen(PORT, () => {
  console.log(`[llm-proxy] Running on port ${PORT} — proxying to ${CONFIG.baseUrl}`);
});
