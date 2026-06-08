/**
 * Upload Service — handles large video file uploads (up to 500 MB)
 * Supports both direct upload AND chunked upload for reliability on slow connections.
 *
 * Chunked upload flow:
 *   1. POST /upload/init       → returns { uploadId }
 *   2. POST /upload/chunk      → send each chunk (repeats)
 *   3. POST /upload/complete   → assemble chunks, create DB record
 *
 * Direct upload flow (still supported):
 *   POST /upload/video         → single request upload
 *
 * Port: 3031
 */

import { jwtVerify } from "jose";
import path from "path";
import fs from "fs";

// ──────────────────── Config ────────────────────
const PORT = 3031;
const PROJECT_ROOT = path.resolve(import.meta.dir, "../..");
const UPLOAD_DIR = path.join(PROJECT_ROOT, "upload", "videos");
const CHUNK_DIR = path.join(PROJECT_ROOT, "upload", "chunks");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB per chunk
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "donciel-tm-secret-key-2024-dev-only"
);
const COOKIE_NAME = "donciel-tm-token";
const VALID_CATEGORIES = ["STRUCTURE", "BIAIS", "ZONES", "MODELS", "SETUPS"];

// Ensure directories exist
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CHUNK_DIR, { recursive: true });

// ──────────────────── Active uploads tracking ────────────────────
interface UploadSession {
  uploadId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  category: string;
  title: string;
  description: string;
  userId: string;
  receivedChunks: Set<number>;
  createdAt: number;
}

const activeUploads = new Map<string, UploadSession>();

// Clean up stale sessions (older than 2 hours) every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activeUploads) {
    if (now - session.createdAt > 2 * 60 * 60 * 1000) {
      // Clean up chunk files
      for (let i = 0; i < session.totalChunks; i++) {
        const chunkPath = path.join(CHUNK_DIR, `${id}_${i}`);
        try { fs.unlinkSync(chunkPath); } catch {}
      }
      activeUploads.delete(id);
      console.log(`[upload-service] Cleaned up stale session: ${id}`);
    }
  }
}, 30 * 60 * 1000);

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
  maxRequestBodySize: MAX_FILE_SIZE + 10 * 1024 * 1024, // 510 MB
  idleTimeout: 0, // No idle timeout — large uploads can take a long time
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

    // ──────── CHUNKED UPLOAD: Initialize ────────
    if (req.method === "POST" && url.pathname === "/upload/init") {
      try {
        const authResult = await authenticate(req.headers.get("cookie") || undefined);
        if (!authResult) return jsonResponse({ error: "Non autorisé" }, 401);
        if (authResult.user.role !== "admin") return jsonResponse({ error: "Accès réservé aux administrateurs" }, 403);

        const body = await req.json();
        const { filename, totalSize, totalChunks, category, title, description } = body;

        if (!title) return jsonResponse({ error: "Titre requis" }, 400);
        if (!category || !VALID_CATEGORIES.includes(category)) return jsonResponse({ error: "Catégorie invalide" }, 400);
        if (totalSize > MAX_FILE_SIZE) return jsonResponse({ error: "Fichier trop volumineux (max 500 Mo)" }, 413);
        if (!totalChunks || totalChunks < 1) return jsonResponse({ error: "totalChunks requis" }, 400);

        const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

        activeUploads.set(uploadId, {
          uploadId,
          filename: filename || "video.mp4",
          totalSize,
          totalChunks,
          category,
          title,
          description: description || "",
          userId: authResult.user.id,
          receivedChunks: new Set(),
          createdAt: Date.now(),
        });

        console.log(`[upload-service] Upload initialized: ${uploadId} (${(totalSize / 1024 / 1024).toFixed(1)} MB, ${totalChunks} chunks)`);

        return jsonResponse({ uploadId, maxChunkSize: MAX_CHUNK_SIZE }, 200);
      } catch (error: any) {
        console.error("[upload-service] Init error:", error);
        return jsonResponse({ error: "Erreur lors de l'initialisation" }, 500);
      }
    }

    // ──────── CHUNKED UPLOAD: Upload chunk ────────
    if (req.method === "POST" && url.pathname === "/upload/chunk") {
      try {
        const authResult = await authenticate(req.headers.get("cookie") || undefined);
        if (!authResult) return jsonResponse({ error: "Non autorisé" }, 401);

        const formData = await req.formData();
        const uploadId = formData.get("uploadId") as string;
        const chunkIndex = parseInt(formData.get("chunkIndex") as string, 10);
        const chunkFile = formData.get("chunk") as File | null;

        if (!uploadId || isNaN(chunkIndex) || !chunkFile) {
          return jsonResponse({ error: "Paramètres manquants (uploadId, chunkIndex, chunk)" }, 400);
        }

        const session = activeUploads.get(uploadId);
        if (!session) return jsonResponse({ error: "Session d'upload non trouvée" }, 404);
        if (session.userId !== authResult.user.id) return jsonResponse({ error: "Non autorisé" }, 403);

        if (chunkFile.size > MAX_CHUNK_SIZE) {
          return jsonResponse({ error: `Chunk trop volumineux (max ${MAX_CHUNK_SIZE / 1024 / 1024} Mo)` }, 413);
        }

        // Write chunk to disk
        const chunkPath = path.join(CHUNK_DIR, `${uploadId}_${chunkIndex}`);
        await Bun.write(chunkPath, chunkFile);

        session.receivedChunks.add(chunkIndex);

        console.log(`[upload-service] Chunk ${chunkIndex + 1}/${session.totalChunks} received for ${uploadId}`);

        return jsonResponse({
          received: chunkIndex,
          totalReceived: session.receivedChunks.size,
          totalChunks: session.totalChunks,
        }, 200);
      } catch (error: any) {
        console.error("[upload-service] Chunk error:", error);
        return jsonResponse({ error: "Erreur lors de l'upload du chunk" }, 500);
      }
    }

    // ──────── CHUNKED UPLOAD: Complete ────────
    if (req.method === "POST" && url.pathname === "/upload/complete") {
      try {
        const authResult = await authenticate(req.headers.get("cookie") || undefined);
        if (!authResult) return jsonResponse({ error: "Non autorisé" }, 401);

        const body = await req.json();
        const { uploadId } = body;

        if (!uploadId) return jsonResponse({ error: "uploadId requis" }, 400);

        const session = activeUploads.get(uploadId);
        if (!session) return jsonResponse({ error: "Session d'upload non trouvée" }, 404);
        if (session.userId !== authResult.user.id) return jsonResponse({ error: "Non autorisé" }, 403);

        // Verify all chunks received
        if (session.receivedChunks.size !== session.totalChunks) {
          const missing = [];
          for (let i = 0; i < session.totalChunks; i++) {
            if (!session.receivedChunks.has(i)) missing.push(i);
          }
          return jsonResponse({
            error: `Chunks manquants: ${missing.join(", ")}`,
            missingChunks: missing,
          }, 400);
        }

        // Assemble chunks into final file
        const ext = path.extname(session.filename) || ".mp4";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        const finalPath = path.join(UPLOAD_DIR, uniqueName);

        const writeStream = fs.createWriteStream(finalPath);
        for (let i = 0; i < session.totalChunks; i++) {
          const chunkPath = path.join(CHUNK_DIR, `${uploadId}_${i}`);
          const chunkData = fs.readFileSync(chunkPath);
          writeStream.write(chunkData);
          // Delete chunk file after reading
          fs.unlinkSync(chunkPath);
        }
        writeStream.end();

        // Wait for write to finish
        await new Promise<void>((resolve, reject) => {
          writeStream.on("finish", resolve);
          writeStream.on("error", reject);
        });

        // Save video record in database
        const prisma = await getPrisma();
        const relativePath = `upload/videos/${uniqueName}`;
        const video = await prisma.video.create({
          data: {
            category: session.category,
            title: session.title,
            description: session.description || null,
            url: relativePath,
            uploadedBy: session.userId,
          },
          include: {
            uploader: {
              select: { id: true, name: true, email: true },
            },
          },
        });

        // Clean up session
        activeUploads.delete(uploadId);

        console.log(`[upload-service] Video assembled and saved: ${uniqueName} (${(session.totalSize / 1024 / 1024).toFixed(1)} MB)`);

        return jsonResponse({ video }, 201);
      } catch (error: any) {
        console.error("[upload-service] Complete error:", error);
        return jsonResponse({ error: "Erreur lors de la finalisation" }, 500);
      }
    }

    // ──────── DIRECT UPLOAD (legacy, still supported) ────────
    if (req.method === "POST" && url.pathname === "/upload/video") {
      try {
        const authResult = await authenticate(req.headers.get("cookie") || undefined);
        if (!authResult) return jsonResponse({ error: "Non autorisé" }, 401);
        if (authResult.user.role !== "admin") return jsonResponse({ error: "Accès réservé aux administrateurs" }, 403);

        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const title = formData.get("title") as string | null;
        const category = formData.get("category") as string | null;
        const description = formData.get("description") as string | null;

        if (!file) return jsonResponse({ error: "Fichier vidéo requis" }, 400);
        if (!title) return jsonResponse({ error: "Titre requis" }, 400);
        if (!category || !VALID_CATEGORIES.includes(category)) return jsonResponse({ error: "Catégorie invalide" }, 400);
        if (file.size > MAX_FILE_SIZE) return jsonResponse({ error: "Fichier trop volumineux (max 500 Mo)" }, 413);

        const ext = path.extname(file.name) || ".mp4";
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
        const finalPath = path.join(UPLOAD_DIR, uniqueName);

        await Bun.write(finalPath, file);

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

        console.log(`[upload-service] Video uploaded (direct): ${uniqueName} (${(file.size / 1024 / 1024).toFixed(1)} MB)`);

        return jsonResponse({ video }, 201);
      } catch (error: any) {
        console.error("[upload-service] Direct upload error:", error);
        return jsonResponse({ error: "Erreur lors de l'upload de la vidéo" }, 500);
      }
    }

    // 404
    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`[upload-service] Running on port ${PORT} — max file size: 500 MB — chunked upload enabled — idle timeout: disabled`);
