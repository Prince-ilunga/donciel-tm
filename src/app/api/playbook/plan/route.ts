import { NextResponse } from "next/server";
import { fetchPlanRecordMap, renderPlanHtml, NOTION_PUBLIC_URL } from "@/lib/notion-plan";

// Force dynamic rendering so the Notion content is always fresh.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const recordMap = await fetchPlanRecordMap();
    const { title, html } = renderPlanHtml(recordMap);
    return NextResponse.json({
      ok: true,
      title,
      html,
      notionUrl: NOTION_PUBLIC_URL,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load plan", notionUrl: NOTION_PUBLIC_URL },
      { status: 500 }
    );
  }
}
