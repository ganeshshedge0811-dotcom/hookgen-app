import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT =
  "You are a viral short-form video hook writer. Given a content idea, generate ONE punchy hook script for a 2-4 second opening video. The hook must: start with a shocking statement or question, be max 15 words, create instant curiosity, work for Instagram Reels or YouTube Shorts. Return only the hook text, nothing else.";

export async function POST(request: NextRequest) {
  // ── Parse & validate body ────────────────────────────────
  let body: { idea?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const idea = body.idea?.trim();

  if (!idea) {
    return NextResponse.json(
      { error: "Missing required field: idea" },
      { status: 400 }
    );
  }

  // ── Validate API key ─────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
    return NextResponse.json(
      { error: "Server configuration error. Please try again later." },
      { status: 500 }
    );
  }

  // ── Call Gemini API ──────────────────────────────────────
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const prompt = `${SYSTEM_PROMPT}\n\nContent Idea: ${idea}`;

  try {
    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const errData = await geminiRes.json().catch(() => null);
      console.error("Gemini API error:", geminiRes.status, errData);
      
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

    // Extract the generated text from the Gemini response
    const hook: string | undefined =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!hook) {
      console.error("Unexpected Gemini response shape:", JSON.stringify(data));
      return NextResponse.json(
        { error: "Received an empty response from AI.", details: data },
        { status: 500 }
      );
    }

    return NextResponse.json({ hook });
  } catch (err) {
    console.error("Network/fetch error calling Gemini:", err);
    const errorMessage = err instanceof Error ? err.message : "Unable to reach the AI service.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
