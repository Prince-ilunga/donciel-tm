import { fetchPlanRecordMap, getImageSignedUrl } from "@/lib/notion-plan";

export const dynamic = "force-dynamic";

// Proxies a Notion image so it can be displayed in the browser. The raw
// Notion file URLs return 403 without auth cookies, so we fetch the bytes
// server-side (using the signed URL from notion-client) and stream them back.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const blockId = searchParams.get("blockId");
  if (!blockId) {
    return new Response("Missing blockId", { status: 400 });
  }

  try {
    const recordMap = await fetchPlanRecordMap();
    const signedUrl = getImageSignedUrl(recordMap, blockId);
    if (!signedUrl) {
      return new Response("Image not found", { status: 404 });
    }

    const upstream = await fetch(signedUrl, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.notion.so/",
      },
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
    }

    // Notion/S3 sometimes returns a generic "image" content-type. Infer the
    // proper MIME type from the URL extension so the browser renders it.
    let contentType = upstream.headers.get("content-type") || "";
    if (!contentType || contentType === "image" || contentType === "application/octet-stream") {
      const urlLower = signedUrl.toLowerCase();
      if (urlLower.includes(".png")) contentType = "image/png";
      else if (urlLower.includes(".gif")) contentType = "image/gif";
      else if (urlLower.includes(".webp")) contentType = "image/webp";
      else if (urlLower.includes(".svg")) contentType = "image/svg+xml";
      else contentType = "image/jpeg";
    }
    const cacheControl = "public, max-age=600, s-maxage=600";
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      },
    });
  } catch (err: any) {
    return new Response(`Proxy error: ${err?.message || "unknown"}`, {
      status: 500,
    });
  }
}
