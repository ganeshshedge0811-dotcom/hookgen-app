import { NextRequest, NextResponse } from "next/server";

const MODEL_VERSION =
  "847dfa8b01e739d6e920a3e3cf29b8b7c764c0a1cef40e6685f6db6faa8dc5df";

const POLL_INTERVAL_MS = 3_000; // 3 seconds
const MAX_POLL_MS = 3 * 60 * 1_000; // 3 minutes

// Allow this route to run for up to 5 minutes on Vercel (Pro plan)
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!process.env.REPLICATE_API_TOKEN) {
    return NextResponse.json({ error: 'REPLICATE_API_TOKEN not configured' }, { status: 500 });
  }

  // ── Parse & validate body ────────────────────────────────
  let body: { hook?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const hook = body.hook?.trim();

  if (!hook) {
    return NextResponse.json(
      { error: "Missing required field: hook" },
      { status: 400 }
    );
  }

  // ── Validate API token ───────────────────────────────────
  const token = process.env.REPLICATE_API_TOKEN;

  // ── Create prediction ────────────────────────────────────
  const prompt = `Cinematic 2-3 second vertical video (9:16), dynamic motion, no text, vibrant colors. Scene: ${hook}`;

  try {
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "respond-async",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          prompt,
          width: 544,
          height: 960,
          num_frames: 61,
          fps: 24,
        },
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => null);
      console.error("Replicate create error:", createRes.status, errData);
      return NextResponse.json(
        { error: "Failed to start video generation. Please try again." },
        { status: 500 }
      );
    }

    const prediction = await createRes.json();
    const pollUrl: string | undefined =
      prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;

    if (!pollUrl) {
      console.error("No poll URL in prediction response:", prediction);
      return NextResponse.json(
        { error: "Unexpected response from video service." },
        { status: 500 }
      );
    }

    // ── Poll until succeeded / failed / timeout ────────────
    const deadline = Date.now() + MAX_POLL_MS;

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);

      const pollRes = await fetch(pollUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!pollRes.ok) {
        console.error("Replicate poll error:", pollRes.status);
        return NextResponse.json(
          { error: "Error checking video status. Please try again." },
          { status: 500 }
        );
      }

      const status = await pollRes.json();

      if (status.status === "succeeded") {
        // output can be a string URL or an array of URLs
        const videoUrl =
          typeof status.output === "string"
            ? status.output
            : Array.isArray(status.output)
              ? status.output[0]
              : null;

        if (!videoUrl) {
          console.error("No video URL in succeeded prediction:", status);
          return NextResponse.json(
            { error: "Video generated but no URL returned." },
            { status: 500 }
          );
        }

        return NextResponse.json({ videoUrl });
      }

      if (status.status === "failed" || status.status === "canceled") {
        console.error("Prediction failed/canceled:", status.error);
        return NextResponse.json(
          {
            error:
              status.error ||
              "Video generation failed. Please try a different idea.",
          },
          { status: 500 }
        );
      }

      // status is "starting" or "processing" — keep polling
    }

    // ── Timeout ────────────────────────────────────────────
    return NextResponse.json(
      {
        error:
          "Video generation timed out (3 min). The model may be under heavy load — please try again.",
      },
      { status: 504 }
    );
  } catch (err) {
    console.error("Network/fetch error calling Replicate:", err);
    return NextResponse.json(
      {
        error:
          "Unable to reach the video service. Please check your connection and try again.",
      },
      { status: 500 }
    );
  }
}

/* ── helpers ──────────────────────────────────────────────── */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
