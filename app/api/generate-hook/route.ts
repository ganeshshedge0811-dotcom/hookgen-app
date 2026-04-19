import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const idea = body.idea?.trim();

    if (!idea) {
      return NextResponse.json(
        { error: "Missing required field: idea" },
        { status: 400 }
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
    
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Write one viral hook for this idea, max 15 words, shocking and curiosity-driven: ' + idea }],
          },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => null);
      const errorMessage =
        errData?.error?.message ||
        errData?.message ||
        `Gemini API error ${geminiRes.status}: Failed to generate hook.`;
      
      return NextResponse.json(
        { error: errorMessage, details: errData },
        { status: 500 }
      );
    }

    const data = await geminiRes.json();
    const hook = data.candidates[0].content.parts[0].text;

    return NextResponse.json({ hook });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unknown error occurred" },
      { status: 500 }
    );
  }
}
