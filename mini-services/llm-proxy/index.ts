/**
 * LLM Proxy Service — proxies chat completion requests to internal-api.z.ai
 * This service runs on the dev machine where the LLM API is accessible.
 * Vercel's serverless functions can't reach internal-api.z.ai (private IPs),
 * so they call this proxy through the Caddy gateway instead.
 *
 * Port: 3030
 */

import fs from "fs";
import path from "path";
import os from "os";

const PORT = 3030;

// ──────────────────── Load LLM Config ────────────────────
function loadLLMConfig() {
  const configPaths = [
    path.join(process.cwd(), '.z-ai-config'),
    path.join(os.homedir(), '.z-ai-config'),
    '/etc/.z-ai-config'
  ];
  for (const filePath of configPaths) {
    try {
      const configStr = fs.readFileSync(filePath, 'utf-8');
      const config = JSON.parse(configStr);
      if (config.baseUrl && config.apiKey) {
        return config;
      }
    } catch {}
  }
  throw new Error('LLM config not found');
}

// ──────────────────── Bun Server ────────────────────
const server = Bun.serve({
  port: PORT,
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // Health check
    if (req.method === "GET" && url.pathname === "/health") {
      return Response.json({ status: "ok", service: "llm-proxy" });
    }

    // Proxy chat completion requests
    if (req.method === "POST" && url.pathname === "/chat/completions") {
      try {
        const config = loadLLMConfig();
        const body = await req.json();

        const apiUrl = `${config.baseUrl}/chat/completions`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.apiKey}`,
          "X-Z-AI-From": "Z",
        };
        if (config.chatId) headers["X-Chat-Id"] = config.chatId;
        if (config.userId) headers["X-User-Id"] = config.userId;
        if (config.token) headers["X-Token"] = config.token;

        const requestBody = {
          ...body,
          thinking: body.thinking || { type: "disabled" },
        };

        console.log(`[llm-proxy] Proxying request to ${apiUrl} (${(JSON.stringify(requestBody.messages).length / 1024).toFixed(1)}KB)`);

        const response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`[llm-proxy] API error ${response.status}: ${errorBody.substring(0, 200)}`);
          return Response.json({ error: `LLM API error ${response.status}` }, { status: response.status });
        }

        const result = await response.json();
        console.log(`[llm-proxy] Response received (${(JSON.stringify(result).length / 1024).toFixed(1)}KB)`);

        return Response.json(result);
      } catch (error: any) {
        console.error("[llm-proxy] Error:", error.message);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

console.log(`[llm-proxy] Running on port ${PORT} — proxying to internal-api.z.ai`);
