import { NextRequest, NextResponse } from "next/server";
import { readFile } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return NextResponse.json({ error: "jobId 없음" }, { status: 400 });
  try {
    const zip = await readFile(jobId, "sticker-pack.zip");
    return new NextResponse(new Uint8Array(zip), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ogq-sticker-pack-${jobId}.zip"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "ZIP을 찾을 수 없습니다." }, { status: 404 });
  }
}
