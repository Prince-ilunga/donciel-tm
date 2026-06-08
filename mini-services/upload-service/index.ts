/**
 * Upload Service — handles large video file uploads (up to 500 MB)
 * Uses Bun's native HTTP server with streaming file writes.
 *
 * Port: 3031
 * Endpoint: POST /upload/video
 */

import { jwtVerify } from "jose";
import path from "path";
import fs from "fs";
import { createWriteStream } from "fs";
import { Readable } from "stream";

// ──────────────────── Config ────────────────────
const PORT = 3031;
const PROJECT_ROOT = path.resolve(import.meta.dir, "../..");
const UPLOAD_DIR = path.join(PROJECT_ROOT, "upload", "videos");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "donciel-tm-secret-key-2024-dev-only"
);
const COOKIE_NAME = "donciel-tm-token";
const VALID_CATEGORIES = ["STRUCTURE", "BIAIS", "ZONES", "MODELS", "SETUPS"];

// Ensure upload directory exists
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ──────────────────── Prisma (lazy-loaded) ────────────────────
let _prisma: any = null;
async function getPrisma() {
  if (!_prisma) {
    const { PrismaClient } = await import(path.join(PROJECT_ROOT, "node_modules", "@prisma", "client"));
    _prisma = new PrismaClient();
  }
  return _prisma;
}

// ──────────────────── Helpers ────────────────────

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const pair of cookieHeader.split(";")) {
    const [key, ...rest] = pair.split("=");
    cookies[key.trim()] = rest.join("=").trim();
  }
  return cookies;
}

async function authenticate(cookieHeader: string | undefined): Promise<{
  user: { id: string; email: string; role: string; status: string; name: string | null; language: string };
} | null> {
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const prisma = await getPrisma();
    const dbUser = await prisma.user.findUnique({
      where: { id: payload.id as string },
      select: { id: true, email: true, role: true, status: true, name: true, language: true },
    });
    if (!dbUser || dbUser.status !== "approved") return null;
    return { user: dbUser };
  } catch {
    return null;
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

// ──────────────────── Bun Server ────────────────────

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: MAX_FILE_SIZE + 1024 * 1024, // 501 MB to allow for form fields
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
      return jsonResponse({ status: "ok", service: "upload-service" });
    }

    // Video upload endpoint
    if (req.method === "POST" && url.pathname === "/upload/video") {
      try {
        // 1. Authenticate
        const authResult = await authenticate(req.headers.get("cookie") || undefined);
        if (!authResult) {
          return jsonResponse({ error: "Non autorisé" }, 401);
        }

        // 2. Admin check
        if (authResult.user.role !== "admin") {
          return jsonResponse({ error: "Accès réservé aux administrateurs" }, 403);
        }

        // 3. Parse multipart form data using Bun's native parser
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const title = formData.get("title") as string | null;
        const category = formData.get("category") as string | null;
        const description = formData.get("description") as string | null;

        // 4. Validate
        if (!file) {
          return jsonResponse({ error: "Fichier vidéo requis" }, 400);
        }
        if (!title) {
          return jsonResponse({ error: "Titre requis" }, 400);
        }
        if (!category || !VALID_CATEGORIES.includes(category)) {
          return jsonResponse({ error: "Catégorie invalide" }, 400);
        }

        // 5. Check file size
        if (file.size > MAX_FILE_SIZE) {
          return jsonResponse({ error: "Fichier trop volumineux (max 500 Mo)" }, 413);
        }

        // 6. Stream file to disk
        const ext = path.extname(file.name) || ".mp4";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        const finalPath = path.join(UPLOAD_DIR, uniqueName);

        // Use Bun.write() which handles streaming internally
        await Bun.write(finalPath, file);

        // 7. Save video record in database
        const prisma = await getPrisma();
        const relativePath = `upload/videos/${uniqueName}`;
        const video = await prisma.video.create({
          data: {
            category,
            title,
            description: description || null,
            url: relativePath,
            uploadedBy: authResult.user.id,
          },
          include: {
            uploader: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        console.log(`[upload-service] Video uploaded: ${uniqueName} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);

        return jsonResponse({ video }, 201);
      } catch (error: any) {
        console.error("[upload-service] Error:", error);
        return jsonResponse({ error: "Erreur lors de l'upload de la vidéo" }, 500);
      }
    }

    // 404
    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`[upload-service] Running on port ${PORT} — max file size: 500 MB`);
