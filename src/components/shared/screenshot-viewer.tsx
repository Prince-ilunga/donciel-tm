"use client";

import { useAppStore } from "@/stores/app-store";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function ScreenshotViewer() {
  const { screenshotViewerUrl, setScreenshotViewerUrl } = useAppStore();

  return (
    <Dialog open={!!screenshotViewerUrl} onOpenChange={() => setScreenshotViewerUrl(null)}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-border">
        <div className="relative">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setScreenshotViewerUrl(null)}
            className="absolute top-2 right-2 z-10 bg-black/50 text-white hover:bg-black/70"
          >
            <X className="w-4 h-4" />
          </Button>
          {screenshotViewerUrl && (
            <img
              src={screenshotViewerUrl}
              alt="Screenshot"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
