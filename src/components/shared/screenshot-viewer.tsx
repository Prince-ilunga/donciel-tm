"use client";

import { useAppStore } from "@/stores/app-store";
import { X } from "lucide-react";
import { useEffect } from "react";

// Detect if a URL points to a video
function isVideoUrl(url: string): boolean {
  if (!url) return false;
  // Cloudinary video URLs
  if (url.includes('/video/upload/')) return true;
  // Video file extensions
  if (/\.(mp4|webm|mov|avi|mkv|m4v)($|\?)/i.test(url)) return true;
  return false;
}

export function ScreenshotViewer() {
  const { screenshotViewerUrl, setScreenshotViewerUrl } = useAppStore();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && screenshotViewerUrl) {
        e.preventDefault();
        e.stopPropagation();
        setScreenshotViewerUrl(null);
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [screenshotViewerUrl, setScreenshotViewerUrl]);

  // Prevent body scroll when viewer is open
  useEffect(() => {
    if (screenshotViewerUrl) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [screenshotViewerUrl]);

  if (!screenshotViewerUrl) return null;

  const isVideo = isVideoUrl(screenshotViewerUrl);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setScreenshotViewerUrl(null)}
    >
      <button
        onClick={() => setScreenshotViewerUrl(null)}
        className="absolute top-4 right-4 z-10 bg-black/60 text-white hover:bg-black/80 rounded-full p-2 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>
      {isVideo ? (
        <video
          src={screenshotViewerUrl}
          className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl"
          controls
          autoPlay
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={screenshotViewerUrl}
          alt="Screenshot"
          className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}
