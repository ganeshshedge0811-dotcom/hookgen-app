/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idea = body.idea?.trim();

    if (!idea) {
      return NextResponse.json(
        { error: "Missing required field: idea" },
        { status: 400 }
      );
    }

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Write one viral hook for this idea, max 15 words, shocking and curiosity-driven, no hashtags, just the hook text: ' + idea }],
      model: 'llama-3.1-8b-instant'
    });
    
    const hook = completion.choices[0].message.content;
    return NextResponse.json({ hook });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}
