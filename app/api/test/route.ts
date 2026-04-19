import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    gemini: !!process.env.GEMINI_API_KEY,
    replicate: !!process.env.REPLICATE_API_TOKEN
  });
}
